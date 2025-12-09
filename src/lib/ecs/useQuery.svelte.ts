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
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		version

		let id: number | undefined

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[internal].queriesHashMap.get(hash)

		if (query?.version !== initialQueryVersion) {
			entities = world.query(hash)
		}

		/**
		 * A flush function to avoid getting called for every entity added.
		 *
		 * Ex: if 50k entities are added, then this query and sort occurs 50k times
		 * when this hook only needs it to be called once per frame.
		 */
		const flush = () => {
			entities = world.query(hash)
			id = undefined
		}

		return untrack(() => {
			const unsubAdd = world.onQueryAdd(hash, () => {
				if (id) return
				id = window.setTimeout(flush)
			})

			const unsubRemove = world.onQueryRemove(hash, () => {
				if (id) return
				id = window.setTimeout(flush)
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
