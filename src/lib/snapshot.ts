import type { World, Entity } from 'koota'
import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { RenderArmModels, type SceneMetadata } from '$lib/buf/draw/v1/scene_pb'
import { traits } from '$lib/ecs'
import { spawnTransformEntity, spawnDrawingEntities } from '$lib/ecs/spawn-entity'
import type { Settings } from '$lib/hooks/useSettings.svelte'
import { rgbaToHex } from './color'

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
		next.pointColor = rgbaToHex(metadata.pointColor)
	}
	if (metadata.lineWidth !== undefined) {
		next.lineWidth = metadata.lineWidth / 1000
	}
	if (metadata.linePointSize !== undefined) {
		next.lineDotSize = metadata.linePointSize / 1000
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

export const spawnSnapshotEntities = (world: World, snapshot: Snapshot): Entity[] => {
	const entities: Entity[] = []

	for (const transform of snapshot.transforms) {
		entities.push(
			spawnTransformEntity(world, transform, traits.SnapshotAPI, {
				removable: true,
				showAxesHelper: false,
			})
		)
	}

	for (const drawing of snapshot.drawings) {
		entities.push(...spawnDrawingEntities(world, drawing, traits.SnapshotAPI, { removable: true }))
	}

	return entities
}

export const destroyEntities = (world: World, entities: Entity[]): void => {
	for (const entity of entities) {
		if (world.has(entity)) {
			entity.destroy()
		}
	}
}

const getRenderArmModels = (
	renderArmModels: RenderArmModels
): 'colliders' | 'colliders+model' | 'model' => {
	switch (renderArmModels) {
		case RenderArmModels.COLLIDERS:
			return 'colliders'
		case RenderArmModels.UNSPECIFIED:
		case RenderArmModels.COLLIDERS_AND_MODEL:
			return 'colliders+model'
		case RenderArmModels.MODEL:
			return 'model'
	}
}
