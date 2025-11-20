import { $internal as internal, cacheQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'
import { traits } from '.'
import { createSubscriber } from 'svelte/reactivity'

export function useQuery<T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } {
	const world = useWorld()

	// This will rerun every render since parameters will always be a fresh
	// array, but the return value will be stable.
	const hash = cacheQuery(...parameters)

	// Using internals to get the query data.
	const query = world[internal].queriesHashMap.get(hash)!
	const initialQueryVersion = query.version

	let entities: QueryResult<T> = world.query(hash).sort()

	const subscribe = createSubscriber((update) => {
		const unsubAdd = world.onQueryAdd(hash, () => {
			entities = world.query(hash).sort()
			update()
		})

		const unsubRemove = world.onQueryRemove(hash, () => {
			entities = world.query(hash).sort()
			update()
		})

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[internal].queriesHashMap.get(hash)

		if (query?.version !== initialQueryVersion) {
			entities = world.query(hash).sort()
			update()
		}

		return () => {
			unsubAdd()
			unsubRemove()
		}
	})

	// Force reattaching event listeners when the world is reset.
	$effect(() => {
		world[internal].resetSubscriptions.add(subscribe)

		return () => {
			world[internal].resetSubscriptions.delete(subscribe)
		}
	})

	return {
		get current() {
			subscribe()
			return entities
		},
	}
}
