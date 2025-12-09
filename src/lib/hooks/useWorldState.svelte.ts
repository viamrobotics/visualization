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

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
}

export const provideWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')

	$effect(() => {
		const cleanups = resourceNames.current.map(({ name }) => createWorldState(partID.current, name))

		return () => {
			for (const cleanup of cleanups) {
				cleanup()
			}
		}
	})
}

const createWorldState = (partID: string, resourceName: string) => {
	const { invalidate } = useThrelte()
	const world = useWorld()
	const client = createResourceClient(
		WorldStateStoreClient,
		() => partID,
		() => resourceName
	)

	let initialized = $state(false)

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

		if (metadata.color) {
			entityTraits.push(traits.Color(metadata.color))
		}

		if (metadata.colors) {
			entityTraits.push(traits.VertexColors(metadata.colors))
		}

		if (transform.physicalObject) {
			entityTraits.push(traits.Geometry(transform.physicalObject))
		}

		if (metadata.shape === 'line' && metadata.points) {
			entityTraits.push(
				traits.LineGeometry(metadata.points),
				traits.DottedLineColor(metadata.lineDotColor)
			)
		}

		if (metadata.gltf) {
			entityTraits.push(traits.GLTF(metadata.gltf))
		}

		if (metadata.shape === 'arrow') {
			entityTraits.push(traits.Arrow, traits.Instance)
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

	let pendingEvents: TransformEvent[] = []
	let flushScheduled = false

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
