import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

import type { HotkeyKeybinding } from '$lib/keybindings'

export const HOTKEYS_CONTEXT_KEY = Symbol('hotkeys')

export interface HotkeyHandler {
	/**
	 * Whether the shortcut applies right now. Evaluated when the key is pressed, so it can
	 * close over reactive state with no effect wiring. Omitted = applies whenever the
	 * registrant is mounted.
	 *
	 * Test what the action needs, never which mode the app is in. A mode check here is how
	 * two features end up fighting over one key.
	 */
	when?: () => boolean
	run: () => void
}

interface Context {
	/** Registered handlers by catalog id. Reactive, for shortcut listings. */
	readonly handlers: ReadonlyMap<string, ReadonlySet<HotkeyHandler>>
	/** Adds `handler` and returns its release function. Identity-based — each registration stands alone. */
	register: (binding: HotkeyKeybinding, handler: HotkeyHandler) => () => void
}

export const createHotkeys = (): Context => {
	const handlers = new SvelteMap<string, SvelteSet<HotkeyHandler>>()

	return {
		get handlers() {
			return handlers
		},
		register(binding, handler) {
			const set = handlers.get(binding.id) ?? new SvelteSet()
			set.add(handler)
			handlers.set(binding.id, set)

			let released = false
			return () => {
				if (released) return
				released = true

				set.delete(handler)
				if (set.size === 0) {
					handlers.delete(binding.id)
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
 * Contributes the behavior for a catalogued shortcut for as long as the calling component
 * is mounted. Dispatch belongs to the visualizer's always-mounted `KeyboardBindings`
 * dispatcher; a shortcut is inert unless some component implements it and its `when` holds.
 */
export const useHotkey = (binding: HotkeyKeybinding, handler: HotkeyHandler) => {
	const release = useHotkeys().register(binding, handler)
	onDestroy(release)
}
