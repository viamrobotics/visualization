import { untrack } from 'svelte'
import { $internal as internal, cacheQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'

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

	$effect(() => {
		version

		let id: number | undefined

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[internal].queriesHashMap.get(hash)

		if (query?.version !== initialQueryVersion) {
			entities = world.query(hash)
		}

		const cb = () => {
			entities = world.query(hash)
			id = undefined
		}

		return untrack(() => {
			const unsubAdd = world.onQueryAdd(hash, () => {
				if (id) return
				id = window.setTimeout(cb)
			})

			const unsubRemove = world.onQueryRemove(hash, () => {
				if (id) return
				id = window.setTimeout(cb)
			})

			return () => {
				unsubAdd()
				unsubRemove()
			}
		})
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
