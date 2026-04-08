import type { TransformWithUUID } from '@viamrobotics/sdk'
import type { ConfigurableTrait, Entity, Trait, World } from 'koota'

import { Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'

import type { Transform as TransformProto } from '$lib/buf/common/v1/common_pb'
import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'

import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import {
	asFloat32Array,
	asOpacity,
	asRGB,
	inMeters,
	isSingleColor,
	isVertexColors,
	STRIDE,
} from '$lib/buffer'
import { traits } from '$lib/ecs'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parseMetadata } from '$lib/metadata'
import { createPose } from '$lib/transform'

import { ColorFormat } from './buf/draw/v1/metadata_pb'
import { isPointCloud } from './geometry'

const vec3 = new Vector3()
const rgb = { r: 0, g: 0, b: 0 }

const DEFAULT_LINE_WIDTH = 5
const DEFAULT_POINT_SIZE = 10
const DEFAULT_NURBS_DEGREE = 3
const DEFAULT_NURBS_WEIGHT = 1
const DEFAULT_ANIMATION_NAME = ''

const DEFAULT_ARROWS_COLORS = new Uint8Array([0, 255, 0])
const DEFAULT_LINE_COLORS = new Uint8Array([0, 128, 255])
const DEFAULT_LINE_DOT_COLORS = new Uint8Array([0, 0, 139])
const DEFAULT_POINTS_COLORS = new Uint8Array([51, 51, 51])
const DEFAULT_NURBS_COLORS = new Uint8Array([0, 255, 255])
const DEFAULT_OPACITY = 1

export type Transform = TransformWithUUID | TransformProto

type Options = {
	removable?: boolean
}

export const drawTransform = (
	world: World,
	{ referenceFrame, poseInObserverFrame, physicalObject, metadata }: Transform,
	api: Trait,
	options: Options = { removable: true }
): Entity => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(referenceFrame),
		traits.Pose(createPose(poseInObserverFrame?.pose)),
		api,
	]

	if (physicalObject) {
		entityTraits.push(traits.Geometry(physicalObject))
		const center = physicalObject.center
		if (center) entityTraits.push(traits.Center(center))
	} else {
		entityTraits.push(traits.ReferenceFrame)
	}

	if (options.removable) entityTraits.push(traits.Removable)

	const parent = poseInObserverFrame?.referenceFrame
	if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

	const { colors, opacities, showAxesHelper } = parseMetadata(metadata?.fields)

	const pointCloud = isPointCloud(physicalObject?.geometryType)
		? physicalObject.geometryType.value.pointCloud
		: undefined

	if (colors && !pointCloud) {
		if (isVertexColors(colors)) {
			entityTraits.push(traits.Colors(colors))
		} else {
			entityTraits.push(traits.Color(asRGB(colors, rgb)))
		}
	}

	entityTraits.push(traits.Opacity(asOpacity(opacities, DEFAULT_OPACITY)))

	if (showAxesHelper) entityTraits.push(traits.ShowAxesHelper)

	const entity = world.spawn(...entityTraits)

	if (pointCloud) parsePointCloud(world, entity, pointCloud, colors)

	return entity
}

export const drawDrawing = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options: Options = { removable: true }
): Entity[] => {
	const { referenceFrame, poseInObserverFrame, physicalObject, metadata } = drawing

	if (physicalObject?.geometryType?.case === 'model') return drawModel(world, drawing, api, options)

	const entity = world.spawn(
		traits.Name(referenceFrame),
		traits.Pose(createPose(poseInObserverFrame?.pose)),
		api
	)

	const parent = poseInObserverFrame?.referenceFrame
	if (parent && parent !== 'world') entity.add(traits.Parent(parent))

	if (options.removable) entity.add(traits.Removable)
	if (metadata?.showAxesHelper) entity.add(traits.ShowAxesHelper)

	applyShape(entity, drawing)

	return [entity]
}

export const updateTransform = (
	entity: Entity,
	{ poseInObserverFrame, physicalObject, metadata }: Transform,
	options: Options = { removable: true }
): void => {
	entity.set(traits.Pose, createPose(poseInObserverFrame?.pose))

	const parent = poseInObserverFrame?.referenceFrame
	if (parent && parent !== 'world') entity.set(traits.Parent, parent)

	if (physicalObject) {
		traits.updateGeometryTrait(entity, physicalObject)
		const center = physicalObject.center
		if (center) {
			entity.set(traits.Center, center)
		} else {
			entity.remove(traits.Center)
		}
	}

	const { colors, opacities, showAxesHelper } = parseMetadata(metadata?.fields)
	if (colors) {
		if (isPointCloud(physicalObject?.geometryType)) {
			updateColors(entity, colors)
		} else {
			addColorTraits(entity, colors)
		}
	}

	const opacity = asOpacity(opacities, DEFAULT_OPACITY)
	if (opacity < 1) entity.add(traits.Opacity(opacity))

	if (options.removable) entity.add(traits.Removable)
	if (!options.removable) entity.remove(traits.Removable)

	if (showAxesHelper) entity.add(traits.ShowAxesHelper)
	if (!showAxesHelper) entity.remove(traits.ShowAxesHelper)
}

export const updateDrawing = (
	world: World,
	entities: Entity[],
	drawing: Drawing,
	api: Trait,
	options: Options = { removable: true }
): Entity[] => {
	const { poseInObserverFrame, physicalObject, metadata } = drawing

	if (physicalObject?.geometryType?.case === 'model') {
		for (const entity of entities) {
			if (world.has(entity)) entity.destroy()
		}
		return drawDrawing(world, drawing, api, options)
	}

	if (entities.length === 0) return entities

	const entity = entities[0]
	if (!world.has(entity)) return entities

	entity.set(traits.Pose, createPose(poseInObserverFrame?.pose))

	const parent = poseInObserverFrame?.referenceFrame
	if (parent && parent !== 'world') entity.set(traits.Parent, parent)

	if (metadata?.showAxesHelper) entity.add(traits.ShowAxesHelper)
	if (!metadata?.showAxesHelper) entity.remove(traits.ShowAxesHelper)

	updateShape(entity, drawing)

	return entities
}

const applyShape = (entity: Entity, { physicalObject, metadata }: Drawing): void => {
	const colors = metadata?.colors as Uint8Array<ArrayBuffer> | undefined
	const opacities = metadata?.opacities as Uint8Array<ArrayBuffer> | undefined
	const geometryType = physicalObject?.geometryType

	const opacity = asOpacity(opacities, DEFAULT_OPACITY)
	entity.add(traits.Opacity(opacity))

	switch (geometryType?.case) {
		case 'arrows': {
			const poses = asFloat32Array(geometryType.value.poses)
			entity.add(traits.Positions(poses))
			entity.add(traits.Instances({ count: poses.length / STRIDE.ARROWS }))
			addColorTraits(entity, colors ?? DEFAULT_ARROWS_COLORS)
			entity.add(traits.Arrows({ headAtPose: true }))
			break
		}

		case 'line': {
			const positions = asFloat32Array(geometryType.value.positions, inMeters)

			const center = physicalObject?.center
			if (center) entity.add(traits.Center(center))

			addColorTraits(entity, colors ?? DEFAULT_LINE_COLORS)

			const lineWidth = geometryType.value.lineWidth ?? DEFAULT_LINE_WIDTH
			entity.add(traits.LineWidth(lineWidth))
			entity.add(traits.DotSize(geometryType.value.dotSize ?? lineWidth))
			entity.add(traits.LinePositions(positions))

			const dotColors = geometryType.value.dotColors as Uint8Array<ArrayBuffer> | undefined
			entity.add(traits.DotColors(dotColors ?? DEFAULT_LINE_DOT_COLORS))
			break
		}

		case 'points': {
			const positions = asFloat32Array(geometryType.value.positions, inMeters)

			const center = physicalObject?.center
			if (center) entity.add(traits.Center(center))

			const pointColors = colors ?? DEFAULT_POINTS_COLORS
			addColorTraits(entity, pointColors)
			entity.add(traits.PointSize(geometryType.value.pointSize ?? DEFAULT_POINT_SIZE))
			entity.add(
				traits.BufferGeometry(
					createBufferGeometry(positions, {
						colors: isVertexColors(colors) ? colors : undefined,
						colorFormat: ColorFormat.RGB,
					})
				)
			)
			entity.add(traits.Points)
			break
		}

		case 'nurbs': {
			const {
				degree = DEFAULT_NURBS_DEGREE,
				knots: knotsBuffer,
				weights: weightsBuffer,
				controlPoints: controlPointsBuffer,
			} = geometryType.value

			const knots = asFloat32Array(knotsBuffer).values().toArray()
			const weights = weightsBuffer ? asFloat32Array(weightsBuffer as Uint8Array<ArrayBuffer>) : []
			const controlPointsArray = asFloat32Array(controlPointsBuffer)
			const numControlPoints = controlPointsArray.length / STRIDE.NURBS_CONTROL_POINTS
			const controlPoints: Vector4[] = Array.from({ length: numControlPoints })

			for (let j = 0; j < numControlPoints; j += 1) {
				const idx = j * STRIDE.NURBS_CONTROL_POINTS
				vec3
					.set(controlPointsArray[idx], controlPointsArray[idx + 1], controlPointsArray[idx + 2])
					.multiplyScalar(0.001)
				controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? DEFAULT_NURBS_WEIGHT)
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

			const center = physicalObject?.center
			if (center) entity.add(traits.Center(center))

			addColorTraits(entity, colors ?? DEFAULT_NURBS_COLORS)
			entity.add(traits.LineWidth(geometryType.value.lineWidth ?? DEFAULT_LINE_WIDTH))
			entity.add(traits.LinePositions(points))
			break
		}

		default: {
			const center = physicalObject?.center
			if (center) entity.add(traits.Center(center))
			if (colors) addColorTraits(entity, colors)
			break
		}
	}
}

const drawModel = (
	world: World,
	{ referenceFrame, poseInObserverFrame, physicalObject }: Drawing,
	api: Trait,
	{ removable = true }: Options
): Entity[] => {
	const entities: Entity[] = []
	const parent = poseInObserverFrame?.referenceFrame
	const geometryType = physicalObject?.geometryType

	if (geometryType?.case !== 'model') return entities

	const baseTraits: ConfigurableTrait[] = [
		traits.Name(referenceFrame),
		traits.Pose(createPose(poseInObserverFrame?.pose)),
		api,
	]

	if (parent && parent !== 'world') baseTraits.push(traits.Parent(parent))
	if (removable) baseTraits.push(traits.Removable)

	entities.push(world.spawn(...baseTraits, traits.ReferenceFrame))

	const { scale, animationName } = geometryType.value
	let i = 1
	for (const asset of geometryType.value.assets) {
		const subEntityTraits: ConfigurableTrait[] = [
			traits.Name(`${referenceFrame} model ${i++}`),
			traits.Parent(referenceFrame),
			api,
		]

		if (scale) subEntityTraits.push(traits.Scale(scale))

		if (asset.content.case === 'url') {
			subEntityTraits.push(
				traits.GLTF({
					source: { url: asset.content.value },
					animationName: animationName ?? DEFAULT_ANIMATION_NAME,
				})
			)
		} else if (asset.content.value) {
			subEntityTraits.push(
				traits.GLTF({
					source: { glb: asset.content.value as Uint8Array<ArrayBuffer> },
					animationName: animationName ?? DEFAULT_ANIMATION_NAME,
				})
			)
		}

		entities.push(world.spawn(...subEntityTraits))
	}

	return entities
}

const parsePointCloud = (
	world: World,
	entity: Entity,
	pointCloud: Uint8Array,
	colors?: Uint8Array
): void => {
	parsePcdInWorker(new Uint8Array(pointCloud)).then((pointcloud) => {
		if (!world.has(entity)) {
			console.error('Entity was destroyed before pointcloud could be added')
			return
		}

		const numPoints = pointcloud.positions.length / STRIDE.POSITIONS
		if (colors && isSingleColor(colors)) entity.add(traits.Color(asRGB(colors, rgb)))

		let vertexColors = pointcloud.colors
		if (colors && colors.length > 0) vertexColors = parseColors(colors, numPoints)

		const geometry = createBufferGeometry(pointcloud.positions, {
			colors: vertexColors ?? undefined,
			colorFormat: ColorFormat.RGB,
		})
		entity.add(traits.BufferGeometry(geometry))
		entity.add(traits.Points)
	})
}

const updateColors = (entity: Entity, colors: Uint8Array): void => {
	const buffer = entity.get(traits.BufferGeometry)
	if (!buffer) {
		addColorTraits(entity, colors)
		return
	}

	const position = buffer.getAttribute('position')
	const count = position?.count ?? 0
	const array = position?.array as Float32Array
	updateBufferGeometry(buffer, array, {
		colors: parseColors(colors, count),
		colorFormat: ColorFormat.RGB,
	})
}

const parseColors = (from: Uint8Array | undefined, count: number): Uint8Array => {
	const colors = from ?? new Uint8Array([255, 0, 0])
	if (isVertexColors(colors)) return colors

	const expanded = new Uint8Array(count * STRIDE.COLORS_RGB)
	for (let i = 0; i < count; i++) {
		for (let c = 0; c < STRIDE.COLORS_RGB; c++) {
			expanded[i * STRIDE.COLORS_RGB + c] = colors[c]!
		}
	}

	return expanded
}

const updateShape = (entity: Entity, { physicalObject, metadata }: Drawing): void => {
	const geometryType = physicalObject?.geometryType

	const opacity = asOpacity(metadata?.opacities, DEFAULT_OPACITY)
	entity.set(traits.Opacity, opacity)

	switch (geometryType?.case) {
		case 'arrows': {
			const poses = asFloat32Array(geometryType.value.poses, inMeters)
			entity.set(traits.Positions, poses)
			entity.set(traits.Instances, { count: poses.length / STRIDE.ARROWS })
			setColorTraits(entity, metadata?.colors ?? DEFAULT_ARROWS_COLORS)
			break
		}

		case 'line': {
			const positions = asFloat32Array(geometryType.value.positions, inMeters)

			const center = physicalObject?.center
			if (center) entity.set(traits.Center, center)

			setColorTraits(entity, metadata?.colors ?? DEFAULT_LINE_COLORS)

			const lineWidth = geometryType.value.lineWidth ?? DEFAULT_LINE_WIDTH
			entity.set(traits.LineWidth, lineWidth)
			entity.set(traits.DotSize, geometryType.value.dotSize ?? lineWidth)
			entity.set(traits.LinePositions, positions)

			const dotColors = geometryType.value.dotColors as Uint8Array<ArrayBuffer> | undefined
			entity.set(traits.DotColors, dotColors ?? DEFAULT_LINE_DOT_COLORS)
			break
		}

		case 'points': {
			const positions = asFloat32Array(geometryType.value.positions, inMeters)

			const center = physicalObject?.center
			if (center) entity.set(traits.Center, center)

			setColorTraits(entity, metadata?.colors ?? DEFAULT_POINTS_COLORS)
			entity.set(traits.PointSize, geometryType.value.pointSize ?? DEFAULT_POINT_SIZE)

			const vertexColors = isVertexColors(metadata?.colors) ? metadata.colors : undefined
			const buffer = entity.get(traits.BufferGeometry)
			if (buffer) {
				updateBufferGeometry(buffer, positions, {
					colors: vertexColors,
					colorFormat: ColorFormat.RGB,
				})
			} else {
				entity.add(
					traits.BufferGeometry(
						createBufferGeometry(positions, { colors: vertexColors, colorFormat: ColorFormat.RGB })
					)
				)
				entity.add(traits.Points)
			}
			break
		}

		case 'nurbs': {
			const {
				degree = DEFAULT_NURBS_DEGREE,
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
				controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? DEFAULT_NURBS_WEIGHT)
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

			const center = physicalObject?.center
			if (center) entity.set(traits.Center, center)

			setColorTraits(entity, metadata?.colors ?? DEFAULT_NURBS_COLORS)
			entity.set(traits.LineWidth, geometryType.value.lineWidth ?? DEFAULT_LINE_WIDTH)
			entity.set(traits.LinePositions, points)
			break
		}
	}
}

const addColorTraits = (entity: Entity, colors: Uint8Array): void => {
	if (isVertexColors(colors)) {
		entity.add(traits.Colors(colors))
	} else {
		entity.add(traits.Color(asRGB(colors, rgb)))
	}
}

const setColorTraits = (entity: Entity, colors: Uint8Array): void => {
	if (isVertexColors(colors)) {
		entity.set(traits.Colors, colors)
		entity.remove(traits.Color)
	} else {
		entity.set(traits.Color, asRGB(colors, rgb))
		entity.remove(traits.Colors)
	}
}
