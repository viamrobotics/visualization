import { Geometry, Transform, type TransformWithUUID } from '@viamrobotics/sdk'
import type { Trait, Entity, ConfigurableTrait, World } from 'koota'
import { Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/examples/jsm/Addons.js'
import { createBufferGeometry } from '../attribute'
import { asFloat32Array, STRIDE } from '../buffer'
import type { Drawing } from '../draw/v1/drawing_pb'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parseMetadata } from '../metadata'
import * as traits from './traits'

const vec3 = new Vector3()

export const spawnTransformEntity = (
	world: World,
	transform: Transform | TransformWithUUID,
	api: Trait,
	options?: { removable?: boolean; invalidate?: () => void }
): Entity => {
	const entityTraits: ConfigurableTrait[] = [
		traits.Name(transform.referenceFrame),
		traits.Geometry(transform.physicalObject ?? Geometry.fromJson({})),
		traits.Center(transform.physicalObject?.center),
		api,
	]

	const { removable = true, invalidate } = options ?? {}
	if (removable) entityTraits.push(traits.Removable)

	const poseInFrame = transform.poseInObserverFrame
	entityTraits.push(traits.Pose(poseInFrame?.pose))

	const parent = poseInFrame?.referenceFrame
	if (parent && parent !== 'world') {
		entityTraits.push(traits.Parent(parent))
	}

	if (transform.metadata) {
		const { colors } = parseMetadata(transform.metadata.fields)
		if (colors) entityTraits.push(...getColorTraits(colors))
	}

	const entity = world.spawn(...entityTraits)

	if (transform.physicalObject?.geometryType?.case === 'pointcloud') {
		parsePcdInWorker(new Uint8Array(transform.physicalObject.geometryType.value.pointCloud)).then(
			(pointcloud) => {
				if (!world.has(entity)) {
					console.error('Entity was destroyed before pointcloud could be added')
					return
				}
				const vertexColors = entity.get(traits.DrawServiceVertexColors)
				const colors = vertexColors && vertexColors.length > 0 ? vertexColors : pointcloud.colors
				const geometry = createBufferGeometry(pointcloud.positions, colors)
				entity.add(traits.BufferGeometry(geometry))
				entity.add(traits.Points)
				invalidate?.()
			}
		)
	}

	return entity
}

export const spawnDrawingEntities = (
	world: World,
	drawing: Drawing,
	api: Trait,
	options?: { removable?: boolean }
): Entity[] => {
	const { removable = true } = options ?? {}
	const entities: Entity[] = []
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	if (geometryType?.case === 'arrows') {
		const poses = asFloat32Array(geometryType.value.poses)
		const colors = drawing.metadata?.colors
		const entityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.Positions(poses as Float32Array<ArrayBuffer>),
			traits.Arrows({ headAtPose: true }),
			traits.Instances({ count: poses.length / STRIDE.ARROWS }),
			api,
		]

		if (removable) entityTraits.push(traits.Removable)
		if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))
		if (colors) entityTraits.push(traits.Colors(colors as Uint8Array<ArrayBuffer>))

		const entity = world.spawn(...entityTraits)
		entities.push(entity)
	} else if (geometryType?.case === 'model') {
		const rootEntityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			traits.ReferenceFrame,
			api,
		]

		if (removable) rootEntityTraits.push(traits.Removable)
		if (parent && parent !== 'world') rootEntityTraits.push(traits.Parent(parent))

		const rootEntity = world.spawn(...rootEntityTraits)
		entities.push(rootEntity)

		let i = 1
		for (const asset of geometryType.value.assets) {
			const subEntityTraits: ConfigurableTrait[] = [
				traits.Name(`${drawing.referenceFrame} model ${i++}`),
				traits.Parent(drawing.referenceFrame),
				api,
			]

			if (removable) subEntityTraits.push(traits.Removable)
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

			const entity = world.spawn(...subEntityTraits)
			entities.push(entity)
		}
	} else {
		const entityTraits: ConfigurableTrait[] = [
			traits.Name(drawing.referenceFrame),
			traits.Pose(poseInFrame?.pose),
			api,
		]

		if (removable) entityTraits.push(traits.Removable)
		if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

		if (drawing.metadata?.colors) {
			entityTraits.push(...getColorTraits(drawing.metadata.colors as Uint8Array<ArrayBuffer>))
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
				traits.LinePositions(positions as Float32Array<ArrayBuffer>),
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
			const numControlPoints = controlPointsArray.length / STRIDE.NURBS_CONTROL_POINTS
			const controlPoints: Vector4[] = new Array(numControlPoints)
			for (let j = 0; j < numControlPoints; j += 1) {
				const idx = j * STRIDE.NURBS_CONTROL_POINTS
				vec3
					.set(controlPointsArray[idx], controlPointsArray[idx + 1], controlPointsArray[idx + 2])
					.multiplyScalar(0.001)
				// FIX: Create new Vector4 for each control point instead of reusing module-level vec4
				controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? 1)
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

			entityTraits.push(traits.LineWidth(10))
			entityTraits.push(traits.LinePositions(points))
		}

		const entity = world.spawn(...entityTraits)
		entities.push(entity)
	}

	return entities
}

export const updateTransformEntity = (
	world: World,
	entity: Entity,
	transform: Transform | TransformWithUUID,
	invalidate?: () => void
): void => {
	if (!world.has(entity)) {
		console.error('Cannot update entity that does not exist')
		return
	}

	const poseInFrame = transform.poseInObserverFrame
	if (poseInFrame?.pose) {
		entity.set(traits.Pose, poseInFrame.pose)
	}

	const parent = poseInFrame?.referenceFrame
	if (parent && parent !== 'world') {
		entity.set(traits.Parent, parent)
	} else if (entity.has(traits.Parent)) {
		entity.remove(traits.Parent)
	}

	if (transform.physicalObject) {
		const geometryUpdate = traits.updateGeometry(transform.physicalObject)
		if (geometryUpdate.length === 2) {
			const [traitConstructor, value] = geometryUpdate
			entity.set(traitConstructor as any, value)
		}
	}

	if (transform.physicalObject?.center) {
		entity.set(traits.Center, transform.physicalObject.center)
	}

	// Update color/opacity from metadata
	if (transform.metadata?.fields) {
		const colors = transform.metadata.fields['colors']
		if (colors) {
			const value = colors.kind?.value
			if (typeof value === 'string') {
				const binary = atob(value)
				const colorBytes = new Uint8Array(binary.length)
				for (let i = 0; i < binary.length; i++) {
					colorBytes[i] = binary.charCodeAt(i)
				}

				const colorTraits = getColorTraits(colorBytes)
				for (const trait of colorTraits) {
					const [traitFn, traitValue] = trait as any
					entity.set(traitFn, traitValue)
				}
			}
		}
	}

	if (transform.physicalObject?.geometryType?.case === 'pointcloud') {
		parsePcdInWorker(new Uint8Array(transform.physicalObject.geometryType.value.pointCloud)).then(
			(pointcloud) => {
				if (!world.has(entity)) {
					console.error('Entity was destroyed before pointcloud could be added')
					return
				}
				const vertexColors = entity.get(traits.DrawServiceVertexColors)
				const colors = vertexColors && vertexColors.length > 0 ? vertexColors : pointcloud.colors
				const geometry = createBufferGeometry(pointcloud.positions, colors)
				entity.set(traits.BufferGeometry, geometry)
				if (!entity.has(traits.Points)) {
					entity.add(traits.Points)
				}
				invalidate?.()
			}
		)
	}
}

export const updateDrawingEntities = (
	world: World,
	entities: Entity[],
	drawing: Drawing,
	api: Trait,
	options?: { removable?: boolean }
): Entity[] => {
	const { geometryType } = drawing.physicalObject ?? {}
	const oldGeometryType = entities.length > 0 ? getDrawingGeometryType(entities[0]) : undefined
	if (oldGeometryType !== geometryType?.case) {
		for (const entity of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
		return spawnDrawingEntities(world, drawing, api, options)
	}

	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame

	if (geometryType?.case === 'arrows') {
		if (entities.length > 0) {
			const entity = entities[0]
			if (world.has(entity)) {
				if (poseInFrame?.pose) entity.set(traits.Pose, poseInFrame.pose)
				if (parent && parent !== 'world') {
					entity.set(traits.Parent, parent)
				} else if (entity.has(traits.Parent)) {
					entity.remove(traits.Parent)
				}

				const poses = asFloat32Array(geometryType.value.poses)
				entity.set(traits.Positions, poses as Float32Array<ArrayBuffer>)
				entity.set(traits.Instances, { count: poses.length / STRIDE.ARROWS })

				const colors = drawing.metadata?.colors
				if (colors) {
					entity.set(traits.Colors, colors as Uint8Array<ArrayBuffer>)
				}
			}
		}

		return entities
	} else if (geometryType?.case === 'model') {
		// TODO: Better way to handle model updates?
		for (const entity of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}

		return spawnDrawingEntities(world, drawing, api, options)
	} else {
		if (entities.length > 0) {
			const entity = entities[0]
			if (world.has(entity)) {
				if (poseInFrame?.pose) entity.set(traits.Pose, poseInFrame.pose)
				if (parent && parent !== 'world') {
					entity.set(traits.Parent, parent)
				} else if (entity.has(traits.Parent)) {
					entity.remove(traits.Parent)
				}

				if (drawing.metadata?.colors) {
					const colorTraits = getColorTraits(drawing.metadata.colors as Uint8Array<ArrayBuffer>)
					for (const trait of colorTraits) {
						const [traitFn, traitValue] = trait as any
						entity.set(traitFn, traitValue)
					}
				}

				if (drawing.physicalObject?.center) {
					entity.set(traits.Center, drawing.physicalObject.center)
				}

				if (geometryType?.case === 'line') {
					const positions = asFloat32Array(geometryType.value.positions)
					for (let i = 0, l = positions.length; i < l; i += 1) {
						positions[i] *= 0.001
					}

					entity.set(traits.LinePositions, positions as Float32Array<ArrayBuffer>)

					if (geometryType.value.lineWidth) {
						entity.set(traits.LineWidth, geometryType.value.lineWidth)
					}

					if (geometryType.value.pointSize) {
						entity.set(traits.PointSize, geometryType.value.pointSize * 0.001)
					}
				} else if (geometryType?.case === 'points') {
					const positions = asFloat32Array(geometryType.value.positions)
					for (let i = 0, l = positions.length; i < l; i += 1) {
						positions[i] *= 0.001
					}

					const colors = drawing.metadata?.colors
					const geometry = createBufferGeometry(positions, colors)
					entity.set(traits.BufferGeometry, geometry)
					if (geometryType.value.pointSize) {
						entity.set(traits.PointSize, geometryType.value.pointSize * 0.001)
					}
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
					const numControlPoints = controlPointsArray.length / STRIDE.NURBS_CONTROL_POINTS
					const controlPoints: Vector4[] = new Array(numControlPoints)
					for (let j = 0; j < numControlPoints; j += 1) {
						const idx = j * STRIDE.NURBS_CONTROL_POINTS
						vec3
							.set(
								controlPointsArray[idx],
								controlPointsArray[idx + 1],
								controlPointsArray[idx + 2]
							)
							.multiplyScalar(0.001)
						controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? 1)
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

					entity.set(traits.LineWidth, 10)
					entity.set(traits.LinePositions, points)
				}
			}
		}
		return entities
	}
}

function getDrawingGeometryType(entity: Entity): string | undefined {
	if (entity.has(traits.Arrows)) return 'arrows'
	if (entity.has(traits.ReferenceFrame) && entity.has(traits.GLTF)) return 'model'
	if (entity.has(traits.LinePositions)) return 'line'
	// TODO: Could add nurbs, but treat them the same as line
	if (entity.has(traits.Points)) return 'points'
	return undefined
}

export const getColorTraits = (colors: Uint8Array<ArrayBuffer>): ConfigurableTrait[] => {
	if (colors.length === 4) {
		return [
			traits.Color({
				r: colors[0] / 255,
				g: colors[1] / 255,
				b: colors[2] / 255,
			}),
			traits.Opacity(colors[3] / 255),
		]
	} else {
		return [traits.DrawServiceVertexColors(colors as Uint8Array<ArrayBuffer>)]
	}
}

