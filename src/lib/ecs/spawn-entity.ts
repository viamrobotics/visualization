import type { World, Entity, Trait, ConfigurableTrait } from 'koota'
import type { Transform } from '$lib/buf/common/v1/common_pb'
import type { TransformWithUUID } from '@viamrobotics/sdk'
import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'
import { Color, Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js'
import * as traits from './traits'
import { parseMetadata } from '$lib/metadata'
import { asColor, asFloat32Array, asOpacity, STRIDE } from '$lib/buffer'
import { createBufferGeometry } from '$lib/attribute'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { createPose } from '$lib/transform'

const vec3 = new Vector3()
const colorUtil = new Color()

export const spawnTransformEntity = (
	world: World,
	transform: Transform | TransformWithUUID,
	api: Trait,
	options?: { removable?: boolean; invalidate?: () => void; showAxesHelper?: boolean }
): Entity => {
	const { removable = true, invalidate, showAxesHelper = true } = options ?? {}
	const poseInFrame = transform.poseInObserverFrame
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.Pose(createPose(poseInFrame?.pose)),
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

	const parent = poseInFrame?.referenceFrame
	if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

	if (transform.metadata) {
		const { colors } = parseMetadata(transform.metadata.fields)
		if (colors) entityTraits.push(...getColorTraits(colors))
	}

	const entity = world.spawn(...entityTraits)

	if (transform.physicalObject?.geometryType?.case === 'pointcloud') {
		spawnPointcloud(
			world,
			entity,
			transform.physicalObject.geometryType.value.pointCloud,
			invalidate
		)
	}

	return entity
}

export const applyTransformGeometry = (
	world: World,
	entity: Entity,
	physicalObject: Transform['physicalObject'],
	options?: { invalidate?: () => void }
): void => {
	const { invalidate } = options ?? {}

	entity.remove(
		traits.Box,
		traits.Sphere,
		traits.Capsule,
		traits.BufferGeometry,
		traits.Points,
		traits.Center
	)

	if (!physicalObject) return

	if (physicalObject.center) entity.add(traits.Center(physicalObject.center))

	entity.add(traits.Geometry(physicalObject))

	if (physicalObject.geometryType.case === 'pointcloud') {
		spawnPointcloud(world, entity, physicalObject.geometryType.value.pointCloud, invalidate)
	}
}

export const spawnDrawingEntities = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options?: { removable?: boolean }
): Entity[] => {
	const { removable = true } = options ?? {}
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	if (geometryType?.case === 'model') return spawnModelDrawing(world, drawing, api, { removable })

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

export const applyDrawingShape = (entity: Entity, drawing: Drawing): void => {
	entity.remove(
		traits.Positions,
		traits.Arrows,
		traits.Instances,
		traits.Colors,
		traits.Color,
		traits.Opacity,
		traits.PointColor,
		traits.LinePositions,
		traits.LineWidth,
		traits.PointSize,
		traits.BufferGeometry,
		traits.Points,
		traits.Center
	)

	const { geometryType } = drawing.physicalObject ?? {}

	switch (geometryType?.case) {
		case 'arrows': {
			const poses = asFloat32Array(geometryType.value.poses)
			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined

			if (colors) entity.add(traits.Colors(colors))

			entity.add(traits.Positions(poses))
			entity.add(traits.Arrows({ headAtPose: true }))
			entity.add(traits.Instances({ count: poses.length / STRIDE.ARROWS }))
			break
		}

		case 'line': {
			const positions = asFloat32Array(geometryType.value.positions)
			for (let i = 0, l = positions.length; i < l; i += 1) positions[i] *= 0.001

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
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

			entity.add(traits.LinePositions(positions))
			entity.add(traits.LineWidth(geometryType.value.lineWidth))
			entity.add(traits.PointSize(geometryType.value.pointSize))
			break
		}

		case 'points': {
			const positions = asFloat32Array(geometryType.value.positions)
			for (let i = 0, l = positions.length; i < l; i += 1) positions[i] *= 0.001

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			const numPoints = positions.length / 3
			const hasVertexColors =
				colors && (colors.length === numPoints * 3 || colors.length === numPoints * 4)

			if (!hasVertexColors && colors) {
				for (const t of getColorTraits(colors)) entity.add(t)
			}
			if (geometryType.value.pointSize) {
				entity.add(traits.PointSize(geometryType.value.pointSize * 0.001))
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

			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			if (colors) {
				for (const t of getColorTraits(colors)) entity.add(t)
			}

			entity.add(traits.LinePositions(points))
			break
		}

		default: {
			// Box, sphere, capsule, and other geometry shapes with a single color
			if (drawing.physicalObject?.center) {
				entity.add(traits.Center(drawing.physicalObject.center))
			}

			const colors = drawing.metadata?.colors as Uint8Array<ArrayBuffer> | undefined
			if (colors) {
				for (const t of getColorTraits(colors)) entity.add(t)
			}
			break
		}
	}
}

const spawnModelDrawing = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options?: { removable?: boolean }
): Entity[] => {
	const { removable = true } = options ?? {}
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
	invalidate?: () => void
): void => {
	parsePcdInWorker(new Uint8Array(pointCloud)).then((pointcloud) => {
		if (!world.has(entity)) {
			console.error('Entity was destroyed before pointcloud could be added')
			return
		}
		const vertexColors = entity.get(traits.Colors)
		const colors = vertexColors && vertexColors.length > 0 ? vertexColors : pointcloud.colors
		const geometry = createBufferGeometry(pointcloud.positions, colors)
		entity.add(traits.BufferGeometry(geometry))
		entity.add(traits.Points)
		invalidate?.()
	})
}

const getColorTraits = (colors: Uint8Array<ArrayBuffer>): ConfigurableTrait[] => {
	asColor(colors, colorUtil)
	const result: ConfigurableTrait[] = [
		traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }),
	]
	const isRgba = colors.length % STRIDE.COLORS_RGBA === 0
	if (isRgba) result.push(traits.Opacity(asOpacity(colors, 1, 3)))
	return result
}
