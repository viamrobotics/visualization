import { PersistedState } from 'runed'
import { getContext, setContext, untrack } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

import { createFavoriteMachinesClient } from './favoriteMachinesClient'

const key = Symbol('favorite-machines-context')

interface Context {
	/** Machine ids the user has starred on app.viam.com. */
	readonly ids: ReadonlySet<string>
	/** Whether starred machines sort above the rest, independent of the column sort. */
	isFavoritesFirst: boolean
	readonly error: string | undefined
	/** Stars or unstars a machine. Shows at once and rolls back if the server refuses. */
	setFavorite: (machineId: string, isFavorite: boolean) => Promise<void>
	refetch: () => void
}

/**
 * The user's favorite machines, shared with app.viam.com's machines page. Provided once at the
 * layout, beside the machine list, so the set survives the machines popover closing.
 *
 * @param getAccessToken The session's current access token. Logging out clears the favorites.
 */
export const provideFavoriteMachines = (getAccessToken: () => string | undefined): Context => {
	const ids = new SvelteSet<string>()
	let error = $state<string>()
	let refetchCount = $state(0)

	// On by default, as on app.viam.com. The header star turns it off.
	const favoritesFirst = new PersistedState<boolean>('viam-account-favorites-first', true)

	const client = $derived.by(() => {
		const accessToken = getAccessToken()
		return accessToken ? createFavoriteMachinesClient(accessToken) : undefined
	})

	$effect(() => {
		const currentClient = client
		void refetchCount
		if (!currentClient) {
			// untrack: clearing reads the set's size, which would make this effect depend on it.
			untrack(() => ids.clear())
			error = undefined
			return
		}

		let isCancelled = false
		currentClient
			.listFavoriteMachines({})
			.then(({ favorites }) => {
				if (isCancelled) return
				ids.clear()
				for (const favorite of favorites) {
					if (favorite.machine) ids.add(favorite.machine.id)
				}
				error = undefined
			})
			.catch((listError: Error) => {
				if (!isCancelled) error = `Could not load favorite machines: ${listError.message}`
			})

		return () => {
			isCancelled = true
		}
	})

	const setFavorite = async (machineId: string, isFavorite: boolean) => {
		if (!client) return
		const update = (value: boolean) => (value ? ids.add(machineId) : ids.delete(machineId))

		update(isFavorite)
		try {
			await (isFavorite
				? client.addFavoriteMachine({ machineId })
				: client.removeFavoriteMachine({ machineId }))
			error = undefined
		} catch (setError) {
			update(!isFavorite)
			error = `Couldn't update favorites: ${(setError as Error).message}`
		}
	}

	const context: Context = {
		get ids() {
			return ids
		},
		get isFavoritesFirst() {
			return favoritesFirst.current
		},
		set isFavoritesFirst(value: boolean) {
			favoritesFirst.current = value
		},
		get error() {
			return error
		},
		setFavorite,
		refetch: () => {
			refetchCount += 1
		},
	}

	setContext(key, context)
	return context
}

export const useFavoriteMachines = (): Context => getContext(key)
