import type { Entity, World } from 'koota'

import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import type { Settings } from '$lib/hooks/useSettings.svelte'

import { RenderArmModels, type SceneMetadata } from '$lib/buf/draw/v1/scene_pb'
import { traits } from '$lib/ecs'

import { rgbToHex } from './color'
import { drawDrawing, drawTransform } from './draw'

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
export const spawnSnapshotEntities = (world: World, snapshot: Snapshot): Entity[] => {
	const entities: Entity[] = []
	const options = { removable: true, showAxesHelper: false }

	for (const transform of snapshot.transforms) {
		entities.push(drawTransform(world, transform, traits.SnapshotAPI, options))
	}

	for (const drawing of snapshot.drawings) {
		const drawingEntities = drawDrawing(world, drawing, traits.SnapshotAPI, options)
		for (const e of drawingEntities) {
			entities.push(e)
		}
	}

	return entities
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
