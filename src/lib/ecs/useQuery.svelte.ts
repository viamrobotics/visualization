import { untrack } from 'svelte'
import { $internal as internal, createQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'

export function useQuery<T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } {
	const world = useWorld()
	const query = createQuery(...parameters)

	// Using internals to get the query data.
	const cachedQuery = world[internal].queriesHashMap.get(query.hash)
	const initialQueryVersion = cachedQuery?.version

	let version = $state.raw(0)
	let entities = $state.raw<QueryResult<T>>(world.query(query))

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		version

		// Compare the initial version to the current version to
		// see it the query has changed.
		const cachedQuery = world[internal].queriesHashMap.get(query.hash)

		if (cachedQuery?.version !== initialQueryVersion) {
			entities = world.query(query)
		}

		return untrack(() => {
			const unsubAdd = world.onQueryAdd(query, () => {
				entities = world.query(query)
			})

			const unsubRemove = world.onQueryRemove(query, () => {
				entities = world.query(query)
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
