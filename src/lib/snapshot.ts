import type { ConfigurableTrait, Entity, World } from 'koota'

import { Geometry } from '@viamrobotics/sdk'
import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'

import type { Transform } from '$lib/buf/common/v1/common_pb'
import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import type { Settings } from '$lib/hooks/useSettings.svelte'

import { type Drawing } from '$lib/buf/draw/v1/drawing_pb'
import { RenderArmModels, type SceneMetadata } from '$lib/buf/draw/v1/scene_pb'
import { traits } from '$lib/ecs'
import { parseMetadata } from '$lib/metadata'

import { createBufferGeometry } from './attribute'
import { asColor, asFloat32Array, asOpacity, isPerVertexColors, STRIDE } from './buffer'
import { rgbToHex } from './color'

const vec3 = new Vector3()
const colorUtil = new Color()

/**
 * Merges scene-level metadata (grid, camera, point/line settings) into the
 * current viewer settings. Millimetre values from the proto are converted
 * to metres.
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

/**
 * Spawns ECS entities for every transform and drawing in a {@link Snapshot}.
 *
 * Each transform produces one entity with Name, Pose, Parent, Geometry, and
 * optional Color/Opacity traits. Each drawing produces one or more entities
 * depending on the geometry type (arrows, points, line, nurbs, model, or
 * simple shapes like box/sphere/capsule).
 *
 * @returns The spawned entities — pass them to {@link destroyEntities} to
 *          clean up before loading a new snapshot.
 */
export const spawnSnapshotEntities = (world: World, snapshot: Snapshot): Entity[] => {
	const entities: Entity[] = []

	for (const transform of snapshot.transforms) {
		entities.push(spawnTransformEntity(world, transform))
	}

	for (const drawing of snapshot.drawings) {
		const drawingEntities = spawnEntitiesFromDrawing(world, drawing)
		for (const e of drawingEntities) {
			entities.push(e)
		}
	}

	return entities
}

/**
 * Destroys a list of entities that are still alive in the given world.
 * Silently skips entities that have already been removed.
 */
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

const spawnTransformEntity = (world: World, transform: Transform): Entity => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.Geometry(transform.physicalObject ?? Geometry.fromJson({})),
		traits.Center(transform.physicalObject?.center),
		traits.SnapshotAPI,
		traits.Removable,
	]

	const poseInFrame = transform.poseInObserverFrame
	entityTraits.push(traits.Pose(poseInFrame?.pose), traits.Parent(poseInFrame?.referenceFrame))

	if (transform.metadata) {
		const metadata = parseMetadata(transform.metadata.fields)
		if (metadata.colors) addColorTraits(entityTraits, metadata.colors, metadata.opacities)
	}

	return world.spawn(...entityTraits)
}

const spawnEntitiesFromDrawing = (world: World, drawing: Drawing): Entity[] => {
	const entities: Entity[] = []
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	if (geometryType?.case === 'arrows') {
		const poses = asFloat32Array(geometryType.value.poses)
		const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined

		const entityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.Positions(poses),
		]

		if (parent) {
			entityTraits.push(traits.Parent(parent))
		}

		if (colors) {
			entityTraits.push(traits.Colors(colors))
		}

		const entity = world.spawn(
			...entityTraits,

			traits.Arrows({ headAtPose: true }),
			traits.Instances({ count: poses.length / STRIDE.ARROWS }),
			traits.SnapshotAPI,
			traits.Removable
		)

		entities.push(entity)
	} else if (geometryType?.case === 'model') {
		const rootEntityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.ReferenceFrame,
		]

		if (parent) {
			rootEntityTraits.push(traits.Parent(parent))
		}

		const rootEntity = world.spawn(...rootEntityTraits, traits.SnapshotAPI, traits.Removable)

		entities.push(rootEntity)

		let i = 1
		for (const asset of geometryType.value.assets) {
			const entityTraits: ConfigurableTrait[] = [
				traits.Name(`${drawing.referenceFrame} model ${i++}`),
				traits.Parent(drawing.referenceFrame),
			]

			if (geometryType.value.scale) {
				entityTraits.push(traits.Scale(geometryType.value.scale))
			}

			if (asset.content.case === 'url') {
				entityTraits.push(
					traits.GLTF({
						source: { url: asset.content.value },
						animationName: geometryType.value.animationName ?? '',
					})
				)
			} else if (asset.content.value) {
				entityTraits.push(
					traits.GLTF({
						source: { glb: asset.content.value as Uint8Array<ArrayBuffer> },
						animationName: geometryType.value.animationName ?? '',
					})
				)
			}

			const entity = world.spawn(...entityTraits, traits.SnapshotAPI, traits.Removable)

			entities.push(entity)
		}
	} else {
		const entityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
		]

		if (parent && parent !== 'world') {
			entityTraits.push(traits.Parent)
		}

		if (drawing.physicalObject?.center) {
			entityTraits.push(traits.Center(drawing.physicalObject.center))
		}

		if (geometryType?.case === 'line') {
			const positions = asFloat32Array(geometryType.value.positions)

			for (let i = 0, l = positions.length; i < l; i += 1) {
				positions[i] *= 0.001
			}

			entityTraits.push(
				traits.LinePositions(positions),
				traits.LineWidth(geometryType.value.lineWidth),
				traits.PointSize((geometryType.value.pointSize ?? 0) * 0.001)
			)

			// Lines pack exactly 2 RGB colors: [lineColor, pointColor]
			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			const opacities = drawing.metadata?.opacities as Uint8Array<ArrayBuffer> | undefined
			if (colors && colors.length >= STRIDE.COLORS_RGB) {
				asColor(colors, colorUtil, 0)
				entityTraits.push(traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))

				const opacity = asOpacity(opacities)
				if (opacity < 1) entityTraits.push(traits.Opacity(opacity))

				if (colors.length >= STRIDE.COLORS_RGB * 2) {
					asColor(colors, colorUtil, STRIDE.COLORS_RGB)
					entityTraits.push(traits.PointColor({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))
				}
			}
		} else if (geometryType?.case === 'points') {
			const positions = asFloat32Array(geometryType.value.positions)

			for (let i = 0, l = positions.length; i < l; i += 1) {
				positions[i] *= 0.001
			}

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			const opacities = drawing.metadata?.opacities as Uint8Array<ArrayBuffer> | undefined
			const numPoints = positions.length / STRIDE.POSITIONS
			const vertexColors = colors && isPerVertexColors(colors, numPoints) ? colors : undefined
			const geometry = createBufferGeometry(positions, { colors: vertexColors, opacities })
			entityTraits.push(traits.BufferGeometry(geometry))

			if (colors && !vertexColors) {
				addColorTraits(entityTraits, colors, opacities)
			}

			if (geometryType.value.pointSize) {
				entityTraits.push(traits.PointSize(geometryType.value.pointSize * 0.001))
			}

			entityTraits.push(traits.Points)
		} else if (geometryType?.case === 'nurbs') {
			const {
				degree = 3,
				knots: knotsBuffer,
				weights: weightsBuffer,
				controlPoints: controlPointsBuffer,
			} = geometryType.value

			const knots = [...asFloat32Array(knotsBuffer)]
			const weights = weightsBuffer
				? [...asFloat32Array(weightsBuffer as Uint8Array<ArrayBuffer>)]
				: []
			const controlPointsArray = [...asFloat32Array(controlPointsBuffer)]
			const controlPoints: Vector4[] = []

			for (
				let i = 0, j = 0, l = controlPointsArray.length / STRIDE.NURBS_CONTROL_POINTS;
				i < l;
				i += STRIDE.NURBS_CONTROL_POINTS, j += 1
			) {
				vec3
					.set(controlPointsArray[0], controlPointsArray[1], controlPointsArray[2])
					.multiplyScalar(0.001)
				controlPoints.push(new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? 0))
			}

			const curve = new NURBSCurve(degree, knots, controlPoints)

			const numPoints = 600
			const points = new Float32Array(numPoints * 3)
			const l = numPoints * 3
			for (let i = 0; i < l; i += 3) {
				curve.getPointAt(i / (l - 1), vec3)
				points[i + 0] = vec3.x
				points[i + 1] = vec3.y
				points[i + 2] = vec3.z
			}

			entityTraits.push(traits.LinePositions(points))

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			const opacities = drawing.metadata?.opacities as Uint8Array<ArrayBuffer> | undefined
			if (colors) {
				addColorTraits(entityTraits, colors, opacities)
			}
		} else {
			// Box, sphere, capsule, and other geometry shapes with a single color
			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			const opacities = drawing.metadata?.opacities as Uint8Array<ArrayBuffer> | undefined
			if (colors) {
				addColorTraits(entityTraits, colors, opacities)
			}
		}

		const entity = world.spawn(...entityTraits, traits.SnapshotAPI, traits.Removable)

		entities.push(entity)
	}

	return entities
}

const addColorTraits = (
	entityTraits: ConfigurableTrait[],
	bytes: Uint8Array<ArrayBuffer>,
	opacities?: Uint8Array<ArrayBuffer>
) => {
	asColor(bytes, colorUtil)
	entityTraits.push(traits.Color(colorUtil))
	const opacity = asOpacity(opacities)
	if (opacity < 1) entityTraits.push(traits.Opacity(opacity))
}
