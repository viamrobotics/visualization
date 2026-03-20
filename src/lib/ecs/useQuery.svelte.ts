import { createQuery, $internal as internalKey, type QueryParameter, type QueryResult } from 'koota'
import { createSubscriber } from 'svelte/reactivity'

import { useWorld } from './useWorld'

export const useQuery = <T extends QueryParameter[]>(
	...parameters: T
): { current: QueryResult<T> } => {
	const world = useWorld()
	const queryRef = createQuery(...parameters)

	let cache: null | { version: number; hash: string; result: QueryResult<T> } = null

	const subscribe = createSubscriber((update) => {
		let unsubAdd = () => {}
		let unsubRemove = () => {}

		const subscribe = () => {
			unsubAdd = world.onQueryAdd(queryRef, update)
			unsubRemove = world.onQueryRemove(queryRef, update)

			// Check if query changed before subscriptions were attached
			const query = world[internalKey].queriesHashMap.get(queryRef.hash)
			if (query && cache && query.version !== cache.version) {
				update()
			}
		}

		const handleReset = () => {
			cache = null
			unsubAdd()
			unsubRemove()
			subscribe()
			update()
		}

		subscribe()
		world[internalKey].resetSubscriptions.add(handleReset)

		return () => {
			world[internalKey].resetSubscriptions.delete(handleReset)
			unsubAdd()
			unsubRemove()
		}
	})

	const getResult = (): QueryResult<T> => {
		const query = world[internalKey].queriesHashMap.get(queryRef.hash)

		if (query && cache?.hash === queryRef.hash && cache.version === query.version) {
			return cache.result
		}

		// eslint-disable-next-line unicorn/no-array-sort
		const result = world.query<T>(queryRef).sort()
		const registeredQuery = world[internalKey].queriesHashMap.get(queryRef.hash)!

		cache = {
			hash: queryRef.hash,
			version: registeredQuery.version,
			result,
		}

		return result
	}

	return {
		get current() {
			subscribe()
			return getResult()
		},
	}
}
