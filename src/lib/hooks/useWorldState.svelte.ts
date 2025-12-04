import {
	WorldStateStoreClient,
	TransformChangeType,
	type TransformWithUUID,
	ResourceName,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { fromTransform, parseMetadata } from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'
import { setInUnsafe } from '@thi.ng/paths'
import type { ProcessMessage } from '$lib/world-state-messages'
import { getContext, setContext } from 'svelte'
import { traits, useWorld } from '$lib/ecs'
import { createPose } from '$lib/transform'
import { trait, type ConfigurableTrait } from 'koota'

const key = Symbol('world-state-context')

interface Context {}

const worker = new Worker(new URL('../workers/worldStateWorker', import.meta.url), {
	type: 'module',
})

export const provideWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')

	const current = $derived.by(() =>
		Object.fromEntries(
			resourceNames.current.map(({ name }) => [
				name,
				createWorldState(
					() => partID.current,
					() => name
				),
			])
		)
	)

	setContext<Context>(key, {
		get names() {
			return resourceNames.current
		},
		get current() {
			return current
		},
	})
}

export const useWorldStates = () => {
	return getContext<Context>(key)
}

export const useWorldState = (resourceName: () => string) => {
	return {}
}

const createWorldState = (partID: () => string, resourceName: () => string) => {
	const world = useWorld()
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)

	let initialized = $state(false)
	let transforms = $state.raw<Record<string, TransformWithUUID>>({})

	const transformsList = $derived.by(() => Object.values(transforms))
	const worldObjectsList = $derived.by(() => transformsList.map(fromTransform))

	$effect(() => {
		for (const [uuid, transform] of Object.entries(transforms)) {
			const metadata = parseMetadata(transform.metadata?.fields)

			const entityTraits: ConfigurableTrait[] = [
				traits.UUID(uuid),
				traits.Name(transform.referenceFrame),
				traits.Parent(transform.poseInObserverFrame?.referenceFrame),
				traits.Pose(transform.poseInObserverFrame?.pose),
			]

			if (metadata.color) {
				entityTraits.push(traits.Color(metadata.color))
			}

			if (metadata.colors) {
				entityTraits.push(traits.VertexColors(metadata.colors))
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
				entityTraits.push(traits.Arrow)
			}

			world.spawn(...entityTraits)
		}
	})

	let pendingEvents: ProcessMessage['events'] = []
	let flushScheduled = false

	const listUUIDs = createResourceQuery(client, 'listUUIDs')
	const getTransforms = $derived(
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

	const initialize = (initial: TransformWithUUID[]) => {
		const next = { ...transforms }
		for (const transform of initial) {
			next[transform.uuidString] = transform
		}

		transforms = next
		initialized = true
	}

	const applyEvents = (events: ProcessMessage['events']) => {
		if (events.length === 0) return

		const next = { ...transforms }
		for (const event of events) {
			switch (event.type) {
				case TransformChangeType.ADDED:
					next[event.uuidString] = event.transform
					break
				case TransformChangeType.REMOVED:
					delete next[event.uuidString]
					break
				case TransformChangeType.UPDATED: {
					if (event.changes.length === 0) continue

					let toUpdate = next[event.uuidString]
					if (!toUpdate) continue
					for (const [path, value] of event.changes) {
						toUpdate = setInUnsafe(toUpdate, path, value)
					}

					next[event.uuidString] = toUpdate
					break
				}
			}
		}

		transforms = next
	}

	const scheduleFlush = () => {
		if (flushScheduled) return
		flushScheduled = true

		requestAnimationFrame(() => {
			const toApply = pendingEvents
			if (toApply.length === 0) return

			applyEvents(toApply)
			flushScheduled = false
			pendingEvents = []
		})
	}

	$effect(() => {
		if (!getTransforms) return
		if (initialized) return

		if (getTransforms.some((query) => query?.isLoading)) return

		const data = getTransforms
			.flatMap((query) => query?.data ?? [])
			.filter((transform) => transform !== undefined) as TransformWithUUID[]
		if (data.length === 0) return

		initialize(data)
	})

	$effect(() => {
		worker.onmessage = (e: MessageEvent<ProcessMessage>) => {
			if (e.data.type !== 'process') return

			const { events } = e.data ?? { events: [] }
			if (events.length === 0) return

			pendingEvents.push(...events)
			scheduleFlush()
		}

		return () => {
			worker.terminate()
		}
	})

	$effect.pre(() => {
		if (changeStream?.data === undefined) return

		const events = changeStream.data.filter((event) => event.transform !== undefined)
		if (events.length === 0) return

		worker.postMessage({ type: 'change', events })
	})

	return {
		get name() {
			return resourceName()
		},
		get worldObjects() {
			return worldObjectsList
		},
		get listUUIDs() {
			return listUUIDs
		},
		get getTransforms() {
			return getTransforms
		},
	}
}
