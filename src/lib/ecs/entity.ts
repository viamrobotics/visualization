import { Geometry, Transform, type TransformWithUUID } from '@viamrobotics/sdk'
import type { Trait, Entity, ConfigurableTrait, World, TraitTuple } from 'koota'
import { Vector3, Vector4 } from 'three'
import { NURBSCurve } from 'three/examples/jsm/Addons.js'
import { createBufferGeometry } from '../attribute'
import { asFloat32Array, STRIDE } from '../buffer'
import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parseMetadata } from '../metadata'
import * as traits from './traits'
import { snakeCase } from 'lodash-es'

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
		traits.ShowAxesHelper,
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
				const vertexColors = entity.get(traits.Colors)
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
	const poseInFrame = drawing.poseInObserverFrame
	const parent = poseInFrame?.referenceFrame
	const { geometryType } = drawing.physicalObject ?? {}

	const entityTraits: ConfigurableTrait[] = [
		traits.Name(drawing.referenceFrame),
		traits.Pose(poseInFrame?.pose),
		api,
	]

	if (removable) entityTraits.push(traits.Removable)
	if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

	if (geometryType?.case === 'arrows') {
		const colors = drawing.metadata?.colors
		if (colors) {
			entityTraits.push(...getColorTraits(colors as Uint8Array<ArrayBuffer>))
		}

		const poses = asFloat32Array(geometryType.value.poses)
		entityTraits.push(traits.Positions(poses as Float32Array<ArrayBuffer>))
		entityTraits.push(traits.Arrows({ headAtPose: true }))
		entityTraits.push(traits.Instances({ count: poses.length / STRIDE.ARROWS }))

		if (removable) entityTraits.push(traits.Removable)
		if (parent && parent !== 'world') entityTraits.push(traits.Parent(parent))

		const entity = world.spawn(...entityTraits)
		return [entity]
	}

	if (geometryType?.case === 'model') {
		const entities: Entity[] = []
		const rootEntityTraits: ConfigurableTrait[] = [...entityTraits, traits.ReferenceFrame]

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

		return entities
	}

	if (drawing.physicalObject?.center) {
		entityTraits.push(traits.Center(drawing.physicalObject.center))
	}

	if (geometryType?.case === 'line') {
		const positions = asFloat32Array(geometryType.value.positions)
		for (let i = 0, l = positions.length; i < l; i += 1) {
			positions[i] *= 0.001
		}

		entityTraits.push(traits.LinePositions(positions as Float32Array<ArrayBuffer>))
		if (geometryType.value.lineWidth) {
			entityTraits.push(traits.LineWidth(geometryType.value.lineWidth * 0.001))
		}

		if (geometryType.value.pointSize) {
			entityTraits.push(traits.PointSize(geometryType.value.pointSize * 0.001))
		}

		if (drawing.metadata?.colors && drawing.metadata.colors.length >= 8) {
			const colors = drawing.metadata.colors
			entityTraits.push(
				traits.Color({
					r: colors[0] / 255,
					g: colors[1] / 255,
					b: colors[2] / 255,
				}),
				traits.PointColor({
					r: colors[4] / 255,
					g: colors[5] / 255,
					b: colors[6] / 255,
				}),
				traits.Opacity(colors[3] / 255)
			)
		} else if (drawing.metadata?.colors) {
			entityTraits.push(...getColorTraits(drawing.metadata.colors as Uint8Array<ArrayBuffer>))
		}

		const entity = world.spawn(...entityTraits)
		return [entity]
	}

	if (drawing.metadata?.colors) {
		entityTraits.push(...getColorTraits(drawing.metadata.colors as Uint8Array<ArrayBuffer>))
	}

	if (geometryType?.case === 'points') {
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

		const entity = world.spawn(...entityTraits)
		return [entity]
	}

	if (geometryType?.case === 'nurbs') {
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
			controlPoints[j] = new Vector4(vec3.x, vec3.y, vec3.z, weights[j] ?? 1)
		}

		const curve = new NURBSCurve(degree, knots, controlPoints)
		const numPoints = 600
		const points = new Float32Array(numPoints * 3)
		const l = numPoints * 3
		for (let i = 0; i < l; i += 3) {
			const pointIndex = i / 3
			const t = pointIndex / (numPoints - 1)
			curve.getPointAt(t, vec3)
			points[i + 0] = vec3.x
			points[i + 1] = vec3.y
			points[i + 2] = vec3.z
		}

		const lineWidth = geometryType.value.lineWidth ?? 5
		entityTraits.push(traits.LineWidth(lineWidth * 0.001))
		entityTraits.push(traits.LinePositions(points))

		const entity = world.spawn(...entityTraits)
		return [entity]
	}

	return []
}

// Helper to check if a field path should be updated based on the FieldMask
const shouldUpdate = (changes: (string | number)[] | undefined, ...paths: string[]): boolean => {
	if (!changes || changes.length === 0) return true
	const path = paths.map((value) => snakeCase(value)).join('.')
	return changes.some((change) => typeof change === 'string' && change.startsWith(path))
}

export const updateTransformEntity = (
	world: World,
	entity: Entity,
	transform: Transform | TransformWithUUID,
	options?: { invalidate?: () => void; changes?: (string | number)[] }
): void => {
	if (!world.has(entity)) {
		console.error('Cannot update entity that does not exist')
		return
	}

	const { invalidate, changes } = options ?? {}

	if (shouldUpdate(changes, 'poseInObserverFrame', 'pose')) {
		const poseInFrame = transform.poseInObserverFrame
		if (poseInFrame?.pose) {
			entity.set(traits.Pose, poseInFrame.pose)
		}
	}

	if (shouldUpdate(changes, 'poseInObserverFrame', 'referenceFrame')) {
		const poseInFrame = transform.poseInObserverFrame
		const parent = poseInFrame?.referenceFrame
		if (parent && parent !== 'world') {
			entity.set(traits.Parent, parent)
		} else if (entity.has(traits.Parent)) {
			entity.remove(traits.Parent)
		}
	}

	if (shouldUpdate(changes, 'physicalObject')) {
		if (transform.physicalObject) {
			const geometryUpdate = traits.updateGeometry(transform.physicalObject)
			if (geometryUpdate.length === 2) {
				const [traitConstructor, value] = geometryUpdate
				entity.set(traitConstructor as any, value)
			}

			if (transform.physicalObject.center) {
				entity.set(traits.Center, transform.physicalObject.center)
			}

			if (transform.physicalObject.geometryType?.case === 'pointcloud') {
				parsePcdInWorker(
					new Uint8Array(transform.physicalObject.geometryType.value.pointCloud)
				).then((pointcloud) => {
					if (!world.has(entity)) {
						console.error('Entity was destroyed before pointcloud could be added')
						return
					}
					const vertexColors = entity.get(traits.Colors)
					const colors = vertexColors && vertexColors.length > 0 ? vertexColors : pointcloud.colors
					const geometry = createBufferGeometry(pointcloud.positions, colors)
					entity.set(traits.BufferGeometry, geometry)
					if (!entity.has(traits.Points)) {
						entity.add(traits.Points)
					}
					invalidate?.()
				})
			}
		}
	}

	if (shouldUpdate(changes, 'metadata')) {
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
	const oldGeometryType = entities.length > 0 ? getDrawingType(entities[0]) : undefined
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
					for (const [trait, value] of colorTraits) {
						entity.set(trait, value)
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
						const pointIndex = i / 3
						const t = pointIndex / (numPoints - 1)
						curve.getPointAt(t, vec3)
						points[i] = vec3.x
						points[i + 1] = vec3.y
						points[i + 2] = vec3.z
					}

					const lineWidth = geometryType.value.lineWidth ?? 5
					entity.set(traits.LineWidth, lineWidth * 0.001)
					entity.set(traits.LinePositions, points)
				}
			}
		}
		return entities
	}
}

const getDrawingType = (entity: Entity): string | undefined => {
	if (entity.has(traits.Arrows)) return 'arrows'
	if (entity.has(traits.ReferenceFrame) && entity.has(traits.GLTF)) return 'model'
	if (entity.has(traits.LinePositions)) return 'line'
	// TODO: Could add nurbs, but treat them the same as line
	if (entity.has(traits.Points)) return 'points'
	return undefined
}

const getColorTraits = (colors: Uint8Array<ArrayBuffer>): TraitTuple[] => {
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
		return [traits.Colors(colors as Uint8Array<ArrayBuffer>)]
	}
}
