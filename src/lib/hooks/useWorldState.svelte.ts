import {
	WorldStateStoreClient,
	TransformChangeType,
	type TransformChangeEvent,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { parseMetadata } from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { ConfigurableTrait, Entity } from 'koota'
import { createPose } from '$lib/transform'
import { useThrelte } from '@threlte/core'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePlyInput } from '$lib/ply'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { createBufferGeometry } from '../attribute.ts';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute } from 'three';

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
}

type PointCloudStructure = {
	field: string
	offsetBytes: number
	offsetElements: number
	itemSize: number
}[]

type BuiltPointCloud = {
	buffer: BufferGeometry
	interleaved: InterleavedBuffer
	points: number
	strideBytes: number
	strideElements: number
	structure?: PointCloudStructure
	colorFieldOffset?: number
}	

export const buildPointCloud = (data: Uint8Array): BuiltPointCloud => {
	// Fallback for payloads without header: interpret as Float32 XYZ
		const aligned =
			data.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0 ? data : new Uint8Array(data)

		const array = new Float32Array(
			aligned.buffer,
			aligned.byteOffset,
			Math.floor(aligned.byteLength / Float32Array.BYTES_PER_ELEMENT)
		)

		if (array.length % 3 !== 0) {
			throw new Error('Legacy point cloud without header must be float32 XYZ (length % 3 == 0)')
		}

		const points = Math.floor(array.length / 3)
		const interleaved = new InterleavedBuffer(array, 3)
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
		return {
			buffer: geometry,
			interleaved,
			points,
			strideBytes: 3 * Float32Array.BYTES_PER_ELEMENT,
			strideElements: 3,
		}

	// const { baseType, baseSize } = assertUniformity(header)
	// const strideBytes = computeStrideBytes(header)
	// if (strideBytes <= 0) throw new Error('Invalid header: non-positive stride')

	// const ArrayType = typedArrayFor(baseType, baseSize)
	// const points = header.width * header.height
	// const strideElements = Math.floor(strideBytes / ArrayType.BYTES_PER_ELEMENT)
	// const expectedLength = points * strideElements
	// const availableElementsRaw = Math.floor(data.byteLength / ArrayType.BYTES_PER_ELEMENT)
	// if (availableElementsRaw !== expectedLength) {
	// 	throw new Error(
	// 		`Binary size mismatch. expected elements ${expectedLength}, got ${availableElementsRaw}`
	// 	)
	// }

	// const aligned = data.byteOffset % ArrayType.BYTES_PER_ELEMENT === 0 ? data : new Uint8Array(data)
	// const array = new ArrayType(aligned.buffer, aligned.byteOffset, expectedLength)
	// const interleaved = new InterleavedBuffer(array, strideElements)
	// const geometry = new BufferGeometry()
	// const structure = getStructure(header)

	// setPosition(geometry, interleaved, structure)
	// setFieldAttributes(geometry, interleaved, structure)

	// const rgbField = structure.find((f) => f.field.toLowerCase() === 'rgb' && f.itemSize === 1)
	// let rgbFieldOffset: number | undefined
	// if (rgbField) {
	// 	const bytesPerElement = (interleaved.array as TypedArray).BYTES_PER_ELEMENT
	// 	if (bytesPerElement === 4) {
	// 		rgbFieldOffset = rgbField.offsetElements
	// 		const colors = extractRgbColors(interleaved, rgbFieldOffset, 0, points)
	// 		geometry.setAttribute('color', new BufferAttribute(colors, 3))
	// 	}
	// }

	// return {
	// 	buffer: geometry,
	// 	interleaved,
	// 	points,
	// 	strideBytes,
	// 	strideElements,
	// 	structure,
	// 	colorFieldOffset: rgbFieldOffset,
	// }
}

export const provideWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')
	const clients = $derived(
		resourceNames.current.map(({ name }) =>
			createResourceClient(
				WorldStateStoreClient,
				() => partID.current,
				() => name
			)
		)
	)

	$effect(() => {
		const cleanups: (() => void)[] = []

		for (const client of clients) {
			cleanups.push(createWorldState(client))
		}

		return () => {
			for (const cleanup of cleanups) {
				cleanup()
			}
		}
	})
}

const createWorldState = (client: { current: WorldStateStoreClient | undefined }) => {
	const { invalidate } = useThrelte()
	const world = useWorld()

	const entities = new Map<string, Entity>()

	const spawnEntity = (transform: TransformWithUUID) => {
		console.log('spawnEntity', transform)
		if (entities.has(transform.uuidString)) {
			return
		}
		const metadata = parseMetadata(transform.metadata?.fields)
		const pose = createPose(transform.poseInObserverFrame?.pose)

		const entityTraits: ConfigurableTrait[] = []

		const parent = transform.poseInObserverFrame?.referenceFrame
		if (parent && parent !== 'world') {
			entityTraits.push(traits.Parent(parent))
		}

		if (metadata.color) {
			entityTraits.push(traits.Color(metadata.color))
		}

		if (metadata.colors) {
			entityTraits.push(traits.VertexColors(metadata.colors as Float32Array<ArrayBuffer>))
		}

		if (transform.physicalObject) {
			// pcds are a special case since they have to be loaded in a worker
			if (transform.physicalObject.geometryType.case === 'pointcloud') {
				const builtPointCloud = buildPointCloud(new Uint8Array(transform.physicalObject.geometryType.value.pointCloud))
				entityTraits.push(traits.BufferGeometry(builtPointCloud.buffer), traits.Points)
			} else {
				entityTraits.push(traits.Geometry(transform.physicalObject))
			}
		}

		if (metadata.shape === 'line' && metadata.points) {
			const { points } = metadata
			const positions = new Float32Array(points.length * 3)
			for (let i = 0, j = 0, l = points.length * 3; i < l; i += 3, j += 1) {
				positions[i + 0] = points[j].x
				positions[i + 1] = points[j].y
				positions[i + 2] = points[j].z
			}
			entityTraits.push(traits.LinePositions(positions), traits.PointColor(metadata.lineDotColor))
		}

		if (metadata.gltf) {
			entityTraits.push(traits.GLTF({ source: { gltf: metadata.gltf }, animationName: '' }))
		}

		if (metadata.shape === 'arrow') {
			entityTraits.push(traits.Arrow)
		}

		entityTraits.push(
			traits.Name(transform.referenceFrame),
			traits.Pose(pose),
			traits.WorldStateStoreAPI
		)

		const entity = world.spawn(...entityTraits)

		entities.set(transform.uuidString, entity)
	}

	const destroyEntity = (uuid: string) => {
		const entity = entities.get(uuid)

		if (!entity) return

		entity.destroy()
		entities.delete(uuid)
	}

	const updateEntity = (transform: TransformWithUUID, changes: (string | number)[]) => {
		const entity = entities.get(transform.uuidString)

		if (!entity) return

		for (const path of changes) {
			if (typeof path === 'string') {
				if (path.startsWith('poseInObserverFrame.pose')) {
					entity.set(traits.Pose, transform.poseInObserverFrame?.pose ?? createPose())
				} else if (path.startsWith('physicalObject') && transform.physicalObject) {
					const { geometryType } = transform.physicalObject

					if (geometryType.case === 'box') {
						entity.set(traits.Box, createBox(geometryType.value))
					} else if (geometryType.case === 'capsule') {
						entity.set(traits.Capsule, createCapsule(geometryType.value))
					} else if (geometryType.case === 'sphere') {
						entity.set(traits.Sphere, createSphere(geometryType.value))
					} else if (geometryType.case === 'mesh') {
						entity.set(traits.BufferGeometry, parsePlyInput(geometryType.value.mesh))
					}
				}
			}
		}
	}

	let initialized = false
	let flushScheduled = false
	let pendingEvents: TransformEvent[] = []

	const listUUIDs = createResourceQuery(client, 'listUUIDs')
	const getTransformQueries = $derived(
		listUUIDs.data?.map((uuid) => {
			return createResourceQuery(
				client,
				'getTransform',
				() => [uuid] as const,
				() => ({ refetchInterval: false })
			)
		})
	)

	const changeStream = createResourceStream(client, 'streamTransformChanges', {
		refetchMode: 'replace',
	})

	const applyEvents = (events: TransformEvent[]) => {
		for (const event of events) {
			if (event.changeType === TransformChangeType.ADDED) {
				spawnEntity(event.transform)
			} else if (event.changeType === TransformChangeType.REMOVED) {
				destroyEntity(event.transform.uuidString)
			} else if (event.changeType === TransformChangeType.UPDATED) {
				updateEntity(event.transform, event.updatedFields?.paths ?? [])
			} else {
				console.error('Unspecified change type.', event)
			}
		}

		invalidate()
	}

	const scheduleFlush = () => {
		if (flushScheduled) return
		flushScheduled = true

		requestAnimationFrame(() => {
			const toApply = pendingEvents

			applyEvents(toApply)
			flushScheduled = false
			pendingEvents = []
		})
	}

	$effect(() => {
		if (!getTransformQueries) return
		if (initialized) return
		if (getTransformQueries.some((query) => query?.isLoading)) return

		const transforms = getTransformQueries
			.flatMap((query) => query?.data)
			.filter((transform) => transform !== undefined)

		for (const transform of transforms) {
			spawnEntity(transform)
		}

		invalidate()
		initialized = true
	})

	$effect(() => {
		if (changeStream?.data === undefined) return

		const eventsByUUID = new Map<string, TransformEvent>()

		for (const event of changeStream.data) {
			if (!event.transform) {
				continue
			}

			const uuid = event.transform.uuidString
			const existing = eventsByUUID.get(uuid)
			if (!existing) {
				eventsByUUID.set(uuid, event as TransformEvent)
				continue
			}

			switch (event.changeType) {
				case TransformChangeType.REMOVED:
					eventsByUUID.set(uuid, event as TransformEvent)
					break

				case TransformChangeType.ADDED:
					if (existing.changeType !== TransformChangeType.REMOVED) {
						eventsByUUID.set(uuid, event as TransformEvent)
					}
					break

				case TransformChangeType.UPDATED:
					// merge with existing updated event
					if (existing.changeType === TransformChangeType.UPDATED) {
						existing.updatedFields ??= { paths: [] }

						const paths = event.updatedFields?.paths ?? []

						for (const path of paths) {
							if (existing.updatedFields.paths.includes(path)) {
								continue
							}

							existing.updatedFields.paths.push(path)
						}

						existing.transform = event.transform
					} else {
						eventsByUUID.set(uuid, event as TransformEvent)
					}
					break
			}
		}

		pendingEvents.push(...eventsByUUID.values())
		scheduleFlush()
	})

	return () => {
		for (const [, entity] of entities) {
			entity.destroy()
		}
	}
}
