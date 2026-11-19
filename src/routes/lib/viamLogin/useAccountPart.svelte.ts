import { PersistedState } from 'runed'
import { getContext, setContext } from 'svelte'

const key = Symbol('account-part-context')

/** A machine part picked from the logged-in Viam account. */
export interface AccountPart {
	partId: string
	partName: string
	machineName: string
	/** The part's FQDN, resolved when it was picked so a reload can redial without a lookup. */
	host: string
}

interface Context {
	readonly current: AccountPart | null
	set: (part: AccountPart | null) => void
}

/** Persists the account part pick across reloads. A manual config and a pick are never both active. */
export const provideAccountPart = (): Context => {
	const picked = new PersistedState<AccountPart | null>('viam-account-part', null)

	const context: Context = {
		get current() {
			return picked.current
		},
		set: (part) => {
			picked.current = part
		},
	}

	setContext(key, context)
	return context
}

export const useAccountPart = (): Context => getContext(key)
