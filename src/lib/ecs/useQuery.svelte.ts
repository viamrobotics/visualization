import { $internal as internal, cacheQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'
import { createSubscriber } from 'svelte/reactivity'

export function useQuery<T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } {
	const world = useWorld()
	const hash = cacheQuery(...parameters)

	// Using internals to get the query data.
	const query = world[internal].queriesHashMap.get(hash)
	const initialQueryVersion = query?.version

	let version = $state.raw(0)
	let entities = $state.raw<QueryResult<T>>(world.query(hash))

	let updateScheduled = false

	const update = () => {
		entities = world.query(hash).sort()
		updateScheduled = false
	}

	$effect(() => {
		version
		const unsubAdd = world.onQueryAdd(hash, () => {
			if (updateScheduled) return
			queueMicrotask(update)
			updateScheduled = true
		})

		const unsubRemove = world.onQueryRemove(hash, () => {
			if (updateScheduled) return
			queueMicrotask(update)
			updateScheduled = true
		})

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[internal].queriesHashMap.get(hash)

		if (query?.version !== initialQueryVersion) {
			if (!updateScheduled) {
				queueMicrotask(update)
				updateScheduled = true
			}
		}

		return () => {
			unsubAdd()
			unsubRemove()
		}
	})

	// Force reattaching event listeners when the world is reset.
	$effect(() => {
		const handler = () => {
			version += 1
		}

		world[internal].resetSubscriptions.add(handler)

		return () => {
			world[internal].resetSubscriptions.delete(handler)
		}
	})

	return {
		get current() {
			return entities
		},
	}
}
