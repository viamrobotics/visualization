import { PersistedState } from 'runed'
import { getContext, setContext } from 'svelte'

interface PersistedStatesContext {
	storageKey: string | undefined
	/** One live value per base key, so every component inside one visualizer shares it. */
	states: Map<string, { current: unknown }>
}

const key = Symbol('persisted-states')

/**
 * State under `baseKey` remembered in `localStorage` as `<storageKey>:<baseKey>`. Without a
 * `storageKey` it lives in memory only and storage is never read or written. For state with a
 * single owner per visualizer; components share state through `usePersistedStates`.
 */
export const createStoredState = <TValue>(
	storageKey: string | undefined,
	baseKey: string,
	initialValue: TValue
): { current: TValue } => {
	if (storageKey !== undefined) return new PersistedState(`${storageKey}:${baseKey}`, initialValue)

	let value = $state(initialValue)
	return {
		get current() {
			return value
		},
		set current(next: TValue) {
			value = next
		},
	}
}

/**
 * Scopes every persisted value under this visualizer to `storageKey`. Without one, each value is
 * kept in memory for this visualizer alone.
 */
export const providePersistedStates = (storageKey: string | undefined): void => {
	setContext<PersistedStatesContext>(key, { storageKey, states: new Map() })
}

/**
 * Returns a lookup for this visualizer's persisted values. Call it while the component
 * initializes. The lookup can then run anywhere, including inside `$derived` for a key that
 * changes. Each base key resolves to one live value shared by every component in the visualizer.
 * Outside a visualizer the values are in memory and shared only through this lookup.
 */
export const usePersistedStates = (): (<TValue>(
	baseKey: string,
	initialValue: TValue
) => { current: TValue }) => {
	const context = getContext<PersistedStatesContext | undefined>(key) ?? {
		storageKey: undefined,
		states: new Map(),
	}

	return <TValue>(baseKey: string, initialValue: TValue) => {
		const existing = context.states.get(baseKey)
		if (existing) return existing as { current: TValue }

		const state = createStoredState(context.storageKey, baseKey, initialValue)
		context.states.set(baseKey, state)
		return state
	}
}
