import { untrack } from 'svelte'
import { $internal as internal, createQuery, type QueryParameter, type QueryResult } from 'koota'
import { useWorld } from './useWorld'

export function useQuery<T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } {
	const world = useWorld()
	const createdQuery = createQuery(...parameters)

	// Using internals to get the query data.
	const query = world[internal].queriesHashMap.get(createdQuery.hash)
	const initialQueryVersion = query?.version

	let version = $state.raw(0)
	let entities = $state.raw<QueryResult<T>>(world.query(createdQuery))

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		version

		// Compare the initial version to the current version to
		// see it the query has changed.
		const query = world[internal].queriesHashMap.get(createdQuery.hash)

		if (query?.version !== initialQueryVersion) {
			entities = world.query(createdQuery)
		}

		return untrack(() => {
			const unsubAdd = world.onQueryAdd(createdQuery, () => {
				entities = world.query(createdQuery)
			})

			const unsubRemove = world.onQueryRemove(createdQuery, () => {
				entities = world.query(createdQuery)
			})

			return () => {
				unsubAdd()
				unsubRemove()
			}
		})
	})

	const handler = () => {
		version += 1
	}

	// Force reattaching event listeners when the world is reset.
	$effect(() => {
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
