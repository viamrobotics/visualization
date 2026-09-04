import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

export const HOTKEYS_CONTEXT_KEY = Symbol('hotkeys')

export interface HotkeyBinding {
	/** `KeyboardEvent.key` to match, case-insensitively. Single keys only — presses with a modifier held never dispatch. */
	key: string
	/** What the binding does, for tooltips and shortcut listings. */
	description: string
	/**
	 * Whether the binding applies right now. Evaluated when the key is pressed, so
	 * it can close over reactive state with no effect wiring. Omitted = applies
	 * whenever the registrant is mounted.
	 */
	when?: () => boolean
	/**
	 * Suppresses the browser's default action for the key, such as `Space` scrolling
	 * the page or `Backspace` navigating back. Omitted = the default action still fires.
	 */
	preventDefault?: boolean
	run: () => void
}

interface Context {
	/** Registered bindings by normalized key. Reactive, for shortcut listings. */
	readonly bindings: ReadonlyMap<string, ReadonlySet<HotkeyBinding>>
	/** Adds `binding` and returns its release function. Identity-based — each registration stands alone. */
	register: (binding: HotkeyBinding) => () => void
}

export const createHotkeys = (): Context => {
	const bindings = new SvelteMap<string, SvelteSet<HotkeyBinding>>()

	return {
		get bindings() {
			return bindings
		},
		register(binding) {
			const key = binding.key.toLowerCase()
			const set = bindings.get(key) ?? new SvelteSet()
			set.add(binding)
			bindings.set(key, set)

			let released = false
			return () => {
				if (released) return
				released = true

				set.delete(binding)
				if (set.size === 0) {
					bindings.delete(key)
				}
			}
		},
	}
}

export const provideHotkeys = () => {
	const context = createHotkeys()
	setContext<Context>(HOTKEYS_CONTEXT_KEY, context)
	return context
}

export const useHotkeys = () => {
	return getContext<Context>(HOTKEYS_CONTEXT_KEY)
}

/**
 * Contributes a keyboard shortcut for as long as the calling component is
 * mounted. Dispatch belongs to the visualizer's always-mounted `KeyboardBindings`
 * dispatcher; a binding is inert unless the component declaring it is mounted
 * and its `when` holds.
 */
export const useHotkey = (binding: HotkeyBinding) => {
	const release = useHotkeys().register(binding)
	onDestroy(release)
}
