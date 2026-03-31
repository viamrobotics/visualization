import type { ConfigurableTrait, Entity } from 'koota'

import { useThrelte } from '@threlte/core'
import {
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
	WorldStateStoreClient,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { Color } from 'three'

import { createBufferGeometry } from '$lib/attribute'
import { asColor, asOpacity, isPerVertexColors, STRIDE } from '$lib/buffer'
import { traits, useWorld } from '$lib/ecs'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parseMetadata } from '$lib/metadata'
import { parsePlyInput } from '$lib/ply'
import { createPose } from '$lib/transform'

import { usePartID } from './usePartID.svelte'

const colorUtil = new Color()

type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
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

		if (transform.physicalObject) {
			if (transform.physicalObject.geometryType.case === 'pointcloud') {
				const metadataColors = metadata.colors
				parsePcdInWorker(
					new Uint8Array(transform.physicalObject.geometryType.value.pointCloud)
				).then((pointcloud) => {
					const entity = entities.get(transform.uuidString)
					if (!entity) {
						console.error('Entity not found to add pointcloud trait to', transform.uuidString)
						return
					}

					const numPoints = pointcloud.positions.length / STRIDE.POSITIONS
					const vertexColors =
						metadataColors && isPerVertexColors(metadataColors, numPoints)
							? metadataColors
							: pointcloud.colors

					const geometry = createBufferGeometry(pointcloud.positions, {
						colors: vertexColors ?? undefined,
						opacities: metadata.opacities,
					})
					entity.add(traits.BufferGeometry(geometry))
					entity.add(traits.Points)

					if (metadataColors && !isPerVertexColors(metadataColors, numPoints)) {
						asColor(metadataColors, colorUtil)
						entity.add(traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))
						const opacity = asOpacity(metadata.opacities)
						if (opacity < 1) entity.add(traits.Opacity(opacity))
					}

					invalidate()
				})
			} else {
				if (metadata.colors) {
					asColor(metadata.colors, colorUtil)
					entityTraits.push(traits.Color({ r: colorUtil.r, g: colorUtil.g, b: colorUtil.b }))
					const opacity = asOpacity(metadata.opacities)
					if (opacity < 1) entityTraits.push(traits.Opacity(opacity))
				}
				entityTraits.push(traits.Geometry(transform.physicalObject))
			}
		}

		entityTraits.push(
			traits.Name(transform.referenceFrame),
			traits.Pose(pose),
			traits.ShowAxesHelper,
			traits.WorldStateStoreAPI
		)

		const entity = world.spawn(...entityTraits)

		entities.set(transform.uuidString, entity)
	}

	const destroyEntity = (uuid: string) => {
		const entity = entities.get(uuid)

		if (!entity) return

		if (world.has(entity)) {
			entity.destroy()
		}
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
				case TransformChangeType.REMOVED: {
					eventsByUUID.set(uuid, event as TransformEvent)
					break
				}

				case TransformChangeType.ADDED: {
					if (existing.changeType !== TransformChangeType.REMOVED) {
						eventsByUUID.set(uuid, event as TransformEvent)
					}
					break
				}

				case TransformChangeType.UPDATED: {
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
		}

		pendingEvents.push(...eventsByUUID.values())
		scheduleFlush()
	})

	return () => {
		for (const [, entity] of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
	}
}
