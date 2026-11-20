import type { Entity, World } from 'koota'

import type { Snapshot } from '#lib/buf/draw/v1/snapshot_pb.js'
import type { Settings } from '#lib/hooks/useSettings.svelte.js'

import { RenderArmModels, type SceneMetadata } from '#lib/buf/draw/v1/scene_pb.js'
import { traits } from '#lib/ecs/index.js'

import type { Relationship } from './metadata'

import { asFloat32Array, inMeters, isVertexColors } from './buffer'
import { rgbToHex } from './color'
import {
	drawDrawing,
	drawTransform,
	updateDrawing,
	updateModel,
	updateTransform,
	uuidBytesToString,
} from './draw'

export type SnapshotEntity = {
	entity: Entity
	relationships: Relationship[] | undefined
}

/**
 * Merges scene-level metadata (grid, camera, point/line settings) into the
 * current viewer settings. Millimeter values from the proto are converted
 * to meters.
 */
export const applySceneMetadata = (settings: Settings, metadata: SceneMetadata): Settings => {
	const next: Settings = { ...settings }
	if (metadata.grid !== undefined) {
		next.grid = metadata.grid
	}
	if (metadata.gridCellSize !== undefined) {
		next.gridCellSize = metadata.gridCellSize / 1000
	}
	if (metadata.gridSectionSize !== undefined) {
		next.gridSectionSize = metadata.gridSectionSize / 1000
	}
	if (metadata.gridFadeDistance !== undefined) {
		next.gridFadeDistance = metadata.gridFadeDistance / 1000
	}
	if (metadata.pointSize !== undefined) {
		next.pointSize = metadata.pointSize / 1000
	}
	if (metadata.pointColor !== undefined) {
		next.pointColor = rgbToHex(metadata.pointColor)
	}
	if (metadata.lineWidth !== undefined) {
		next.lineWidth = metadata.lineWidth / 1000
	}
	if (metadata.lineDotSize !== undefined) {
		next.lineDotSize = metadata.lineDotSize / 1000
	}
	if (metadata.renderArmModels !== undefined) {
		next.renderArmModels = getRenderArmModels(metadata.renderArmModels)
	}

	if (metadata.sceneCamera?.cameraType.case === 'orthographicCamera') {
		next.cameraMode = 'orthographic'
	} else if (metadata.sceneCamera?.cameraType.case === 'perspectiveCamera') {
		next.cameraMode = 'perspective'
	}

	return next
}

/**
 * Spawns ECS entities for every transform and drawing in a {@link Snapshot}.
 *
 * Each transform produces one entity with Name, Pose, Parent, Geometry, and
 * optional Color/Opacity traits. Each drawing produces one or more entities
 * depending on the geometry type (arrows, points, line, nurbs, model, or
 * simple shapes like box/sphere/capsule).
 *
 * @returns The spawned entities
 */
export const spawnSnapshotEntities = (world: World, snapshot: Snapshot): SnapshotEntity[] => {
	const entities: SnapshotEntity[] = []
	const options = { removable: true, showAxesHelper: false }

	for (const transform of snapshot.transforms) {
		const spawned = drawTransform(world, transform, traits.SnapshotAPI, options)
		entities.push({
			entity: spawned.entity,
			relationships: spawned.relationships,
		})
	}

	for (const drawing of snapshot.drawings) {
		const spawned = drawDrawing(world, drawing, traits.SnapshotAPI, options)
		entities.push({
			entity: spawned.entity,
			relationships: spawned.relationships,
		})
	}

	return entities
}

export interface ReconcileResult {
	current: Map<string, SnapshotEntity>
	unkeyed: SnapshotEntity[]
	spawned: SnapshotEntity[]
	updated: SnapshotEntity[]
}

export const reconcileSnapshotEntities = (
	world: World,
	snapshot: Snapshot,
	prev: Map<string, SnapshotEntity>
): ReconcileResult => {
	const options = { removable: true, showAxesHelper: false }
	const next = new Map(prev)
	const seen = new Set<string>()
	const unkeyed: SnapshotEntity[] = []
	const spawned: SnapshotEntity[] = []
	const updated: SnapshotEntity[] = []

	for (const transform of snapshot.transforms) {
		const uuidStr = uuidBytesToString(transform.uuid)
		if (!uuidStr) {
			const result = drawTransform(world, transform, traits.SnapshotAPI, options)
			const entry = { entity: result.entity, relationships: result.relationships }
			unkeyed.push(entry)
			spawned.push(entry)
			continue
		}

		const existing = next.get(uuidStr)
		if (existing && world.has(existing.entity)) {
			const result = updateTransform(existing.entity, transform, options)
			const entry = { entity: result.entity, relationships: result.relationships }
			next.set(uuidStr, entry)
			updated.push(entry)
		} else {
			const result = drawTransform(world, transform, traits.SnapshotAPI, options)
			const entry = { entity: result.entity, relationships: result.relationships }
			next.set(uuidStr, entry)
			spawned.push(entry)
		}
		seen.add(uuidStr)
	}

	for (const drawing of snapshot.drawings) {
		const uuidStr = uuidBytesToString(drawing.uuid)
		if (!uuidStr) {
			const result = drawDrawing(world, drawing, traits.SnapshotAPI, options)
			const entry = { entity: result.entity, relationships: result.relationships }
			unkeyed.push(entry)
			spawned.push(entry)
			continue
		}

		const existing = next.get(uuidStr)
		const isModel = drawing.physicalObject?.geometryType.case === 'model'

		if (existing && world.has(existing.entity)) {
			if (isModel) {
				const result = updateModel(world, existing.entity, drawing, traits.SnapshotAPI, options)
				const entry = { entity: result.entity, relationships: result.relationships }
				next.set(uuidStr, entry)
				spawned.push(entry)
			} else {
				const result = updateDrawing(world, existing.entity, drawing, options)
				const entry = { entity: result.entity, relationships: result.relationships }
				next.set(uuidStr, entry)
				updated.push(entry)
			}
		} else {
			const result = drawDrawing(world, drawing, traits.SnapshotAPI, options)
			const entry = { entity: result.entity, relationships: result.relationships }
			next.set(uuidStr, entry)
			spawned.push(entry)
		}
		seen.add(uuidStr)
	}

	for (const [uuid, entry] of prev) {
		if (seen.has(uuid)) continue
		if (world.has(entry.entity)) entry.entity.destroy()
		next.delete(uuid)
	}

	return { current: next, unkeyed, spawned, updated }
}

const getRenderArmModels = (
	renderArmModels: RenderArmModels
): 'colliders' | 'colliders+model' | 'model' => {
	switch (renderArmModels) {
		case RenderArmModels.COLLIDERS: {
			return 'colliders'
		}

		case RenderArmModels.UNSPECIFIED:
		case RenderArmModels.COLLIDERS_AND_MODEL: {
			return 'colliders+model'
		}

		case RenderArmModels.MODEL: {
			return 'model'
		}
	}
}

export interface SnapshotPointCloud {
	name: string
	positions: Float32Array
	colors?: Uint8Array
}

/**
 * Decodes every point-cloud drawing in a snapshot into `{ name, positions, colors }`,
 * keyed and merged by `referenceFrame`. Chunked clouds share a referenceFrame, so their
 * positions/colors are concatenated back into one cloud. Inverse of `DrawPoints`.
 *
 * Colors are gated through `isVertexColors`: only genuine per-vertex color arrays are kept;
 * single-uniform-color arrays (3 bytes) are discarded as `undefined`.
 */
export const decodeDrawnSnapshotPointClouds = (snapshot: Snapshot): SnapshotPointCloud[] => {
	const snapshotPointClouds: SnapshotPointCloud[] = []
	for (const drawing of snapshot.drawings) {
		const name = drawing.referenceFrame
		const geometryType = drawing.physicalObject?.geometryType
		if (geometryType?.case === 'points') {
			const positions = asFloat32Array(geometryType.value.positions, inMeters)
			const rawColors = drawing.metadata?.colors
			const colors = isVertexColors(rawColors) ? rawColors : undefined
			snapshotPointClouds.push({ name, positions, colors })
		}
	}

	return snapshotPointClouds
}
