import { getContext, setContext, untrack } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

import type { CameraKeybinding, HotkeyKeybinding, Keybinding } from './keybinding'

export const KEYBINDINGS_CONTEXT_KEY = Symbol('keybindings')

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

interface Registration {
	binding: Keybinding
	/** Absent for a shortcut that only wants to appear in the listing. */
	handler?: HotkeyHandler
}

interface Context {
	/**
	 * Every shortcut present right now, which is every shortcut whose feature is mounted.
	 * Hosts compose their own plugin set, so this is the only honest answer to what the
	 * settings listing should show.
	 */
	readonly bindings: readonly Keybinding[]
	/** The shortcuts a press should run, in registration order. */
	matching: (press: Press) => MatchedHotkey[]
	register: (binding: Keybinding, handler?: HotkeyHandler) => () => void
}

export interface MatchedHotkey {
	binding: HotkeyKeybinding
	handler: HotkeyHandler
}

export interface Press {
	key: string
	shift: boolean
	mod: boolean
}

const matchesPress = (binding: Keybinding, press: Press): binding is HotkeyKeybinding =>
	binding.kind === 'hotkey' &&
	binding.key === press.key.toLowerCase() &&
	(binding.shift ?? false) === press.shift &&
	(binding.mod ?? false) === press.mod

export const createKeybindings = (): Context => {
	const registrations = new SvelteSet<Registration>()

	const warnOnCollision = (binding: Keybinding) => {
		if (binding.kind !== 'hotkey') return

		const press: Press = {
			key: binding.key,
			shift: binding.shift ?? false,
			mod: binding.mod ?? false,
		}

		for (const existing of registrations) {
			if (matchesPress(existing.binding, press)) {
				console.warn(
					`[keybindings] "${binding.id}" and "${existing.binding.id}" both claim the same press`
				)
			}
		}
	}

	return {
		get bindings() {
			return [...registrations].map((registration) => registration.binding)
		},
		matching(press) {
			const matched: MatchedHotkey[] = []

			for (const { binding, handler } of registrations) {
				if (handler !== undefined && matchesPress(binding, press)) {
					matched.push({ binding, handler })
				}
			}

			return matched
		},
		register(binding, handler) {
			if (import.meta.env.DEV) {
				warnOnCollision(binding)
			}

			const registration: Registration = { binding, handler }
			registrations.add(registration)

			return () => registrations.delete(registration)
		},
	}
}

export const provideKeybindings = () => {
	const context = createKeybindings()
	setContext<Context>(KEYBINDINGS_CONTEXT_KEY, context)
	return context
}

export const useKeybindings = (): Context => {
	return getContext<Context>(KEYBINDINGS_CONTEXT_KEY)
}

export interface HotkeyDefinition extends HotkeyHandler, Omit<HotkeyKeybinding, 'kind'> {}

/**
 * Declares a keyboard shortcut and its behavior for as long as the calling component is
 * mounted. Dispatch belongs to the always-mounted `KeyboardBindings`.
 *
 * @returns The shortcut, for handing to `Kbd` so a button's chip and its key cannot drift.
 */
export const useHotkey = ({ when, run, ...rest }: HotkeyDefinition): HotkeyKeybinding => {
	const binding: HotkeyKeybinding = { ...rest, kind: 'hotkey' }
	const keybindings = useKeybindings()

	// Untracked: registering reads the set of registrations to check for a collision, and
	// taking a dependency on it would re-run this every time any other shortcut registers.
	$effect(() => untrack(() => keybindings.register(binding, { when, run })))

	return binding
}

/**
 * Lists a shortcut the dispatcher does not run. `InputBindings` polls these every frame
 * instead, because holding the key has to keep moving the camera rather than fire once.
 *
 * @returns The shortcut, for handing to `Kbd`.
 */
export const useKeybinding = (binding: CameraKeybinding): CameraKeybinding => {
	const keybindings = useKeybindings()

	$effect(() => untrack(() => keybindings.register(binding)))

	return binding
}
