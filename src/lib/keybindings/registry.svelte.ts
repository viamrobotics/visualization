import type {
	CameraKeybinding,
	FixedKeybinding,
	HotkeyKeybinding,
	Keybinding,
	KeybindingGroup,
} from './keybinding'

import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

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
	/** The handlers a press should run, in registration order. */
	handlersFor: (key: string, shift: boolean) => HotkeyHandler[]
	register: (binding: Keybinding, handler?: HotkeyHandler) => () => void
}

const matchesPress = (binding: Keybinding, key: string, shift: boolean) =>
	binding.kind === 'hotkey' &&
	binding.key === key.toLowerCase() &&
	(binding.shift ?? false) === shift

export const createKeybindings = (): Context => {
	const registrations = new SvelteSet<Registration>()

	const warnOnCollision = (binding: Keybinding) => {
		if (binding.kind !== 'hotkey') return

		for (const existing of registrations) {
			if (matchesPress(existing.binding, binding.key, binding.shift ?? false)) {
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
		handlersFor(key, shift) {
			const handlers: HotkeyHandler[] = []

			for (const { binding, handler } of registrations) {
				if (handler !== undefined && matchesPress(binding, key, shift)) {
					handlers.push(handler)
				}
			}

			return handlers
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

export interface HotkeyDefinition extends HotkeyHandler {
	id: string
	key: string
	shift?: boolean
	description: string
	group: KeybindingGroup
}

/**
 * Declares a keyboard shortcut and its behavior for as long as the calling component is
 * mounted. Dispatch belongs to the always-mounted `KeyboardBindings`.
 *
 * @returns The shortcut, for handing to `Kbd` so a button's chip and its key cannot drift.
 */
export const useHotkey = ({ when, run, ...rest }: HotkeyDefinition): HotkeyKeybinding => {
	const binding: HotkeyKeybinding = { ...rest, kind: 'hotkey' }
	const release = useKeybindings().register(binding, { when, run })

	onDestroy(release)

	return binding
}

/** Lists a camera shortcut while its poller is mounted. `InputBindings` reads the key. */
export const useCameraKeybinding = (
	definition: Omit<CameraKeybinding, 'kind'>
): CameraKeybinding => {
	const binding: CameraKeybinding = { ...definition, kind: 'camera' }
	const release = useKeybindings().register(binding)

	onDestroy(release)

	return binding
}

/** Lists a shortcut the calling component matches itself, such as `⌘Z`. */
export const useFixedKeybinding = (definition: Omit<FixedKeybinding, 'kind'>): FixedKeybinding => {
	const binding: FixedKeybinding = { ...definition, kind: 'fixed' }
	const release = useKeybindings().register(binding)

	onDestroy(release)

	return binding
}
