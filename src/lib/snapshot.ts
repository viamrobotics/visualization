import type { World, Entity, ConfigurableTrait } from 'koota'
import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
import type { Snapshot } from '$lib/draw/v1/snapshot_pb'
import { RenderArmModels, type SceneMetadata } from '$lib/draw/v1/scene_pb'
import { type Drawing } from '$lib/draw/v1/drawing_pb'
import type { Transform } from '$lib/common/v1/common_pb'
import { traits } from '$lib/ecs'
import { Geometry } from '@viamrobotics/sdk'
import type { Settings } from '$lib/hooks/useSettings.svelte'
import { parseMetadata } from '$lib/WorldObject.svelte'
import { rgbaBytesToFloat32, rgbaToHex } from './color'
import { asFloat32Array, STRIDE } from './buffer'
import { createPose } from './transform'
import { createBufferGeometry } from './attribute'

const vec3 = new Vector3()
const origin = new Vector3()
const direction = new Vector3()
const color = new Color()
const pose = createPose()

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
		const drawingEntities = spawnEntitiesFromDrawing(world, drawing)
		for (const e of drawingEntities) {
			entities.push(e)
		}
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

const spawnTransformEntity = (world: World, transform: Transform): Entity => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.Geometry(transform.physicalObject ?? Geometry.fromJson({})),
		traits.Center(transform.physicalObject?.center),
		traits.SnapshotAPI,
	]

	const poseInFrame = transform.poseInObserverFrame
	entityTraits.push(traits.Pose(poseInFrame?.pose))
	entityTraits.push(traits.Parent(poseInFrame?.referenceFrame))

	if (transform.metadata) {
		const metadata = parseMetadata(transform.metadata.fields)
		if (metadata.color) {
			entityTraits.push(traits.Color(metadata.color))
		}

		if (metadata.opacity !== undefined) {
			entityTraits.push(traits.Opacity(metadata.opacity))
		}
	}

	return world.spawn(...entityTraits)
}

const spawnEntitiesFromDrawing = (world: World, drawing: Drawing): Entity[] => {
	const entities: Entity[] = []
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	if (geometryType?.case === 'arrows') {
		const rootEntityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.ReferenceFrame,
		]

		if (parent) {
			rootEntityTraits.push(traits.Parent(parent))
		}

		const rootEntity = world.spawn(...rootEntityTraits, traits.SnapshotAPI)

		entities.push(rootEntity)

		const poses = asFloat32Array(geometryType.value.poses)
		const colors = drawing.metadata?.colors
			? asFloat32Array(drawing.metadata.colors as Uint8Array<ArrayBuffer>)
			: []

		for (let i = 0, j = 0, k = 0, l = poses.length; i < l; i += STRIDE.ARROWS, j += 1, k += 4) {
			const entityTraits: ConfigurableTrait[] = [
				traits.Name(`pose ${j}`),
				traits.Parent(drawing.referenceFrame),
			]

			origin.set(poses[i + 0], poses[i + 1], poses[i + 2])
			direction.set(poses[i + 3], poses[i + 4], poses[i + 5])

			// Compute the base position so the arrow ends at the origin
			origin.sub(vec3.copy(direction).multiplyScalar(/** arrow length */ 100))

			pose.x = origin.x
			pose.y = origin.y
			pose.z = origin.z
			pose.oX = direction.x
			pose.oY = direction.y
			pose.oZ = direction.z

			entityTraits.push(traits.Pose(pose))

			if (colors[k + 0] && colors[k + 1] && colors[k + 2]) {
				color.r = colors[k + 0]
				color.g = colors[k + 1]
				color.b = colors[k + 2]
				entityTraits.push(traits.Color(color))
			}

			if (colors[k + 3]) {
				entityTraits.push(traits.Opacity(colors[k + 3]))
			}

			const entity = world.spawn(...entityTraits, traits.Arrow, traits.SnapshotAPI)

			entities.push(entity)
		}
	} else if (geometryType?.case === 'model') {
		const rootEntityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.ReferenceFrame,
		]

		if (parent) {
			rootEntityTraits.push(traits.Parent(parent))
		}

		const rootEntity = world.spawn(...rootEntityTraits, traits.SnapshotAPI)

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

			const entity = world.spawn(...entityTraits, traits.SnapshotAPI)

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

		if (drawing.metadata?.colors) {
			const colors = rgbaBytesToFloat32(drawing.metadata.colors as Uint8Array<ArrayBuffer>)

			if (colors.length === 4) {
				entityTraits.push(
					traits.Color({ r: colors[0], g: colors[1], b: colors[2] }),
					traits.Opacity(colors[3])
				)
			} else {
				entityTraits.push(traits.VertexColors(colors))
			}
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
				traits.PointSize(geometryType.value.pointSize)
			)

			if (geometryType.value.pointSize) {
				entityTraits.push(traits.PointSize(geometryType.value.pointSize * 0.001))
			}
		} else if (geometryType?.case === 'points') {
			const positions = asFloat32Array(geometryType.value.positions)

			for (let i = 0, l = positions.length; i < l; i += 1) {
				positions[i] *= 0.001
			}

			const colors = drawing.metadata?.colors
				? rgbaBytesToFloat32(drawing.metadata.colors as Uint8Array<ArrayBuffer>)
				: undefined
			const geometry = createBufferGeometry(positions, colors)

			entityTraits.push(traits.BufferGeometry(geometry))

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
		}

		const entity = world.spawn(...entityTraits, traits.SnapshotAPI)

		entities.push(entity)
	}

	return entities
}
