import type { TransformWithUUID } from '@viamrobotics/sdk'
import type { ConfigurableTrait, Entity, Trait, World } from 'koota'

import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'

import type { Transform as SnapshotTransform } from '$lib/buf/common/v1/common_pb'
import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'

import { createBufferGeometry } from '$lib/attribute'
import {
	asColor,
	asFloat32Array,
	asOpacity,
	inMetres,
	isPerVertexColors,
	STRIDE,
} from '$lib/buffer'
import { traits } from '$lib/ecs'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parseMetadata } from '$lib/metadata'
import { createPose } from '$lib/transform'

const vec3 = new Vector3()
const colorUtil = new Color()

type SpawnTransformInput = SnapshotTransform | TransformWithUUID

type SpawnTransformOptions = {
	showAxesHelper?: boolean
	removable?: boolean
}

type SpawnDrawingOptions = {
	removable?: boolean
}

export const spawnTransform = (
	world: World,
	transform: SpawnTransformInput,
	api: Trait,
	options: SpawnTransformOptions = {}
): Entity => {
	const { removable = true, showAxesHelper = true } = options

	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.Pose(createPose(transform.poseInObserverFrame?.pose)),
		api,
	]

	if (transform.physicalObject) {
		entityTraits.push(traits.Geometry(transform.physicalObject))
		if (transform.physicalObject.center) {
			entityTraits.push(traits.Center(transform.physicalObject.center))
		}
	} else {
		entityTraits.push(traits.ReferenceFrame)
	}

	if (removable) entityTraits.push(traits.Removable)
	if (showAxesHelper) entityTraits.push(traits.ShowAxesHelper)

	const parent = transform.poseInObserverFrame?.referenceFrame
	if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

	const metadata = parseMetadata(transform.metadata?.fields)
	const pointCloud =
		transform.physicalObject?.geometryType?.case === 'pointcloud'
			? transform.physicalObject.geometryType.value.pointCloud
			: undefined

	if (metadata.colors && !pointCloud) entityTraits.push(...createColorTraits(metadata.colors))

	const entity = world.spawn(...entityTraits)

	if (pointCloud) {
		spawnPointcloud(world, entity, pointCloud, metadata.colors)
	}

	return entity
}

export const spawnDrawing = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options: SpawnDrawingOptions = {}
): Entity[] => {
	const { removable = true } = options
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	if (geometryType?.case === 'model') {
		return spawnModelDrawing(world, drawing, api, { removable })
	}

	const entity = world.spawn(
		traits.Name(drawing.referenceFrame),
		traits.Pose(createPose(poseInFrame?.pose)),
		api
	)

	if (parent && parent !== 'world') entity.add(traits.Parent(parent))
	if (removable) entity.add(traits.Removable)

	applyDrawingShape(entity, drawing)

	return [entity]
}

const applyDrawingShape = (entity: Entity, drawing: Drawing): void => {
	const { geometryType } = drawing.physicalObject ?? {}
	const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined

	switch (geometryType?.case) {
		case 'arrows': {
			const poses = asFloat32Array(geometryType.value.poses)
			entity.add(traits.Positions(poses))
			entity.add(traits.Instances({ count: poses.length / STRIDE.ARROWS }))
			if (colors) entity.add(traits.Colors(colors))
			entity.add(traits.Arrows({ headAtPose: true }))
			break
		}

		case 'line': {
			const positions = asFloat32Array(geometryType.value.positions, inMetres)

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			if (colors && colors.length >= STRIDE.COLORS_RGB) {
				const stride =
					colors.length % STRIDE.COLORS_RGBA === 0 ? STRIDE.COLORS_RGBA : STRIDE.COLORS_RGB
				asColor(colors, colorUtil, 0)
				entity.add(traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))
				if (colors.length >= stride * 2) {
					asColor(colors, colorUtil, stride)
					entity.add(traits.PointColor({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))
					if (stride === STRIDE.COLORS_RGBA) {
						entity.add(traits.Opacity(asOpacity(colors, 1, 3)))
					}
				}
			}

			entity.add(traits.LineWidth(geometryType.value.lineWidth))
			entity.add(traits.PointSize(inMetres(geometryType.value.pointSize ?? 0)))
			entity.add(traits.LinePositions(positions))
			break
		}

		case 'points': {
			const positions = asFloat32Array(geometryType.value.positions, inMetres)

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			const numPoints = positions.length / STRIDE.POSITIONS
			const hasVertexColors = colors && isPerVertexColors(colors, numPoints)

			if (!hasVertexColors && colors) {
				entity.add(...createColorTraits(colors))
			}

			if (geometryType.value.pointSize) {
				entity.add(traits.PointSize(inMetres(geometryType.value.pointSize)))
			}

			entity.add(
				traits.BufferGeometry(createBufferGeometry(positions, hasVertexColors ? colors : undefined))
			)

			entity.add(traits.Points)
			break
		}

		case 'nurbs': {
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
			const numControlPoints = controlPointsArray.length / STRIDE.NURBS_CONTROL_POINTS
			const controlPoints: Vector4[] = Array.from({ length: numControlPoints })

			for (let j = 0; j < numControlPoints; j += 1) {
				const idx = j * STRIDE.NURBS_CONTROL_POINTS
				vec3
					.set(controlPointsArray[idx], controlPointsArray[idx + 1], controlPointsArray[idx + 2])
					.multiplyScalar(0.001)
				controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? 1)
			}

			const curve = new NURBSCurve(degree, knots, controlPoints)
			const numPoints = 600
			const points = new Float32Array(numPoints * 3)
			for (let i = 0; i < numPoints; i += 1) {
				const t = i / (numPoints - 1)
				curve.getPointAt(t, vec3)
				points[i * 3 + 0] = vec3.x
				points[i * 3 + 1] = vec3.y
				points[i * 3 + 2] = vec3.z
			}

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			if (colors) {
				for (const t of createColorTraits(colors)) entity.add(t)
			}

			entity.add(traits.LinePositions(points))
			break
		}

		default: {
			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			if (colors) {
				for (const t of createColorTraits(colors)) entity.add(t)
			}
			break
		}
	}
}

const spawnModelDrawing = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options: SpawnDrawingOptions = {}
): Entity[] => {
	const { removable = true } = options
	const entities: Entity[] = []
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const geometryType = drawing.physicalObject?.geometryType

	if (geometryType?.case !== 'model') return entities

	const baseTraits: ConfigurableTrait[] = [
		traits.Name(drawing.referenceFrame),
		traits.Pose(createPose(poseInFrame?.pose)),
		api,
	]
	if (parent && parent !== 'world') baseTraits.push(traits.Parent(parent))
	if (removable) baseTraits.push(traits.Removable)

	entities.push(world.spawn(...baseTraits, traits.ReferenceFrame))

	let i = 1
	for (const asset of geometryType.value.assets) {
		const subEntityTraits: ConfigurableTrait[] = [
			traits.Name(`${drawing.referenceFrame} model ${i++}`),
			traits.Parent(drawing.referenceFrame),
			api,
		]

		if (geometryType.value.scale) subEntityTraits.push(traits.Scale(geometryType.value.scale))

		if (asset.content.case === 'url') {
			subEntityTraits.push(
				traits.GLTF({
					source: { url: asset.content.value },
					animationName: geometryType.value.animationName ?? '',
				})
			)
		} else if (asset.content.value) {
			subEntityTraits.push(
				traits.GLTF({
					source: { glb: asset.content.value as Uint8Array<ArrayBuffer> },
					animationName: geometryType.value.animationName ?? '',
				})
			)
		}

		entities.push(world.spawn(...subEntityTraits))
	}

	return entities
}

const spawnPointcloud = (
	world: World,
	entity: Entity,
	pointCloud: Uint8Array,
	metadataColors?: Uint8Array<ArrayBuffer>
): void => {
	parsePcdInWorker(new Uint8Array(pointCloud)).then((pointcloud) => {
		if (!world.has(entity)) {
			console.error('Entity was destroyed before pointcloud could be added')
			return
		}

		const numPoints = pointcloud.positions.length / STRIDE.POSITIONS
		const isUniformColor =
			metadataColors !== undefined && !isPerVertexColors(metadataColors, numPoints)

		const vertexColors = isUniformColor
			? (pointcloud.colors ?? undefined)
			: getPointCloudColors(metadataColors, numPoints, pointcloud.colors)

		const geometry = createBufferGeometry(pointcloud.positions, vertexColors)
		entity.add(traits.BufferGeometry(geometry))
		entity.add(traits.Points)

		if (isUniformColor) {
			for (const t of createColorTraits(metadataColors!)) entity.add(t)
		}
	})
}

const getPointCloudColors = (
	metadataColors: Uint8Array<ArrayBuffer> | undefined,
	numPoints: number,
	pcdColors?: Uint8Array | null
): Uint8Array | null | undefined => {
	if (!metadataColors || metadataColors.length === 0) return pcdColors
	if (isPerVertexColors(metadataColors, numPoints)) return metadataColors

	const stride =
		metadataColors.length % STRIDE.COLORS_RGBA === 0 ? STRIDE.COLORS_RGBA : STRIDE.COLORS_RGB
	const expanded = new Uint8Array(numPoints * stride)
	for (let i = 0; i < numPoints; i++) {
		for (let c = 0; c < stride; c++) {
			expanded[i * stride + c] = metadataColors[c]!
		}
	}
	return expanded
}

const createColorTraits = (bytes: Uint8Array<ArrayBuffer>): ConfigurableTrait[] => {
	asColor(bytes, colorUtil)
	const result: ConfigurableTrait[] = [
		traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }),
	]

	const isRgba = bytes.length % STRIDE.COLORS_RGBA === 0
	if (isRgba) result.push(traits.Opacity(asOpacity(bytes)))

	return result
}
