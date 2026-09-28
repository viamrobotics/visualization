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
	 * Whether held Shift is part of the shortcut. Shift is the only modifier dispatch takes:
	 * the command key belongs to the browser, and Option rewrites the character macOS
	 * reports, so an Option shortcut would have to be matched by `code` instead.
	 *
	 * A shortcut without it never fires while Shift is held, so `h` and `Shift+H` stay
	 * separate.
	 */
	shift?: boolean
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

/**
 * A shortcut its own component matches, such as `⌘Z` in `BuildActionsBar` and held Shift in
 * `SelectionTool`. Registered so it reaches the settings listing, never dispatched.
 *
 * Dispatch matches a single key plus Shift, so these combinations could not go through it
 * even if they were handed to it.
 */
export interface FixedKeybinding extends BaseKeybinding {
	kind: 'fixed'
	/** Keys in press order. `Mod` renders as the platform's command or control key. */
	combo: readonly string[]
}

export type Keybinding = CameraKeybinding | FixedKeybinding | HotkeyKeybinding
