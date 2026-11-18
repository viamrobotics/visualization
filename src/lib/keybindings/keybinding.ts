export type KeybindingGroup = 'Camera' | 'Editing' | 'Selection' | 'Transform' | 'View'

interface BaseKeybinding {
	/** Unique among the shortcuts present at once. Keys the stored overrides. */
	id: string
	description: string
	group: KeybindingGroup
}

/** Dispatched on keydown by `KeyboardBindings`. */
export interface HotkeyKeybinding extends BaseKeybinding {
	kind: 'hotkey'
	/** `KeyboardEvent.key`, lowercased. */
	key: string
	/**
	 * Whether held Shift is part of the shortcut. A shortcut without it never fires while
	 * Shift is held, so `h` and `Shift+H` stay separate.
	 */
	shift?: boolean
	/**
	 * Whether the platform's command key is part of the shortcut: the command key on Apple
	 * devices, control elsewhere.
	 *
	 * Option is deliberately absent. macOS rewrites the character it reports, so `Option+H`
	 * arrives as `˙`, and matching it would mean keying the whole catalog on
	 * `KeyboardEvent.code` instead.
	 */
	mod?: boolean
	/**
	 * Whether to cancel the browser's own response to the press. Needed where the browser
	 * claims the combination, such as the save dialog on `⌘S`.
	 */
	preventDefault?: boolean
}

/**
 * Polled every frame by `InputBindings`. Separate from a hotkey because holding the key has
 * to keep moving the camera rather than fire once. Registered so it reaches the settings
 * listing, never dispatched.
 */
export interface CameraKeybinding extends BaseKeybinding {
	kind: 'camera'
	/** `KeyboardEvent.key`, lowercased. */
	key: string
}

export type Keybinding = CameraKeybinding | HotkeyKeybinding
