import { $internal, cacheQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'

export function useQuery<T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } {
	const world = useWorld()

	let initialQueryVersion = 0

	// Used to track if we need to rerun effects internally.
	let version = $state(0)

	// This will rerun every render since parameters will always be a fresh
	// array, but the return value will be stable.
	const hash = $derived(cacheQuery(...parameters))

	$effect(() => {
		// Using internals to get the query data.
		const query = world[$internal].queriesHashMap.get(hash)!
		initialQueryVersion = query.version
	})

	let entities = $state.raw<QueryResult<T>>(world.query(hash).sort())

	// Subscribe to changes.
	$effect(() => {
		const unsubAdd = world.onQueryAdd(hash, () => {
			entities = world.query(hash).sort()
		})

		const unsubRemove = world.onQueryRemove(hash, () => {
			entities = world.query(hash).sort()
		})

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[$internal].queriesHashMap.get(hash)!

		if (query.version !== initialQueryVersion) {
			entities = world.query(hash).sort()
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

		world[$internal].resetSubscriptions.add(handler)

		return () => {
			world[$internal].resetSubscriptions.delete(handler)
		}
	})

	return {
		get current() {
			return entities
		},
	}
}
