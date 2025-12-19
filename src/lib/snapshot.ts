import type { World, Entity, ConfigurableTrait } from 'koota'
import type { Snapshot } from '$lib/draw/v1/snapshot_pb'
import { RenderArmModels, type SceneMetadata } from '$lib/draw/v1/scene_pb'
import { Model, Shape, type Drawing } from '$lib/draw/v1/drawing_pb'
import type { Transform } from '$lib/common/v1/common_pb'
import { traits } from '$lib/ecs'
import { Geometry } from '@viamrobotics/sdk'
import type { Settings } from '$lib/hooks/useSettings.svelte'

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
		entities.push(spawnTransformEntity(world, transform))
	}

	for (const drawing of snapshot.drawings) {
		entities.push(...spawnDrawingEntity(world, drawing))
	}

	return entities
}

export const destroyEntities = (entities: Entity[]): void => {
	for (const entity of entities) {
		entity.destroy()
	}
}

const rgbaToHex = (rgba: Uint8Array): string => {
	if (rgba.length < 3) return '#333333'
	const r = rgba[0]!.toString(16).padStart(2, '0')
	const g = rgba[1]!.toString(16).padStart(2, '0')
	const b = rgba[2]!.toString(16).padStart(2, '0')
	return `#${r}${g}${b}`
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

const spawnTransformEntity = (world: World, transform: Transform): Entity => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.SnapshotAPI,
	]

	const poseInFrame = transform.poseInObserverFrame
	entityTraits.push(traits.Pose(poseInFrame?.pose))
	entityTraits.push(traits.Parent(poseInFrame?.referenceFrame))
	entityTraits.push(traits.Geometry(transform.physicalObject ?? Geometry.fromJson({})))
	return world.spawn(...entityTraits)
}

const spawnDrawingEntity = (world: World, drawing: Drawing): Entity[] => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(drawing.referenceFrame),
		traits.SnapshotAPI,
	]

	const poseInFrame = drawing.poseInObserverFrame
	entityTraits.push(traits.Pose(poseInFrame?.pose))
	entityTraits.push(traits.Parent(poseInFrame?.referenceFrame))
	entityTraits.push(traits.ColorsRGBA(drawing.metadata?.colors))
	const subEntities = addShapeTraits(entityTraits, drawing?.physicalObject ?? Shape.fromJson({}))

	if (subEntities.length > 0) {
		const entities: Entity[] = []
		for (const entity of subEntities) {
			entities.push(world.spawn(...entity))
		}
		return entities
	} else {
		return [world.spawn(...entityTraits)]
	}
}

const addShapeTraits = (entityTraits: ConfigurableTrait[], shape: Shape): ConfigurableTrait[][] => {
	if (shape.center) {
		entityTraits.push(traits.Center(shape.center))
	}

	const { geometryType } = shape
	switch (geometryType.case) {
		case 'arrows':
			entityTraits.push(traits.Arrows(geometryType.value.poses))
			return []

		case 'line':
			entityTraits.push(traits.Positions(geometryType.value.positions))
			entityTraits.push(traits.LineWidth(geometryType.value.lineWidth))
			entityTraits.push(traits.PointSize(geometryType.value.pointSize))
			return []

		case 'points':
			entityTraits.push(traits.Positions(geometryType.value.positions))
			entityTraits.push(traits.PointSize(geometryType.value.pointSize))
			return []

		case 'model':
			return addModelTraits(entityTraits, geometryType.value)

		case 'nurbs':
			entityTraits.push(traits.Poses(geometryType.value.controlPoints))
			entityTraits.push(traits.Knots(geometryType.value.knots))
			entityTraits.push(traits.Degree(geometryType.value.degree))
			entityTraits.push(traits.Weights(geometryType.value.weights))
			return []
	}

	return []
}

const addModelTraits = (entityTraits: ConfigurableTrait[], model: Model): ConfigurableTrait[][] => {
	const subEntities: ConfigurableTrait[][] = []
	for (const asset of model.assets) {
		const modelEntityTraits: ConfigurableTrait[] = [...entityTraits]
		modelEntityTraits.push(traits.MimeType(asset.mimeType))
		modelEntityTraits.push(traits.SizeBytes(Number(asset.sizeBytes)))
		if (asset.content.case === 'url') {
			modelEntityTraits.push(traits.URLContent({ case: 'url', value: asset.content.value }))
		} else if (asset.content.case === 'data') {
			modelEntityTraits.push(traits.DataContent({ case: 'data', value: asset.content.value }))
		}

		if (model.scale) {
			modelEntityTraits.push(traits.Scale(model.scale))
		}
		if (model.animationName !== undefined) {
			modelEntityTraits.push(traits.AnimationName(model.animationName))
		}

		subEntities.push(modelEntityTraits)
	}

	return subEntities
}
