/**
 * Every keyboard shortcut the app answers to, declared in one place.
 *
 * A binding is declared here and implemented elsewhere. The catalog owns the key, the
 * wording, and the grouping; the feature owns the behavior and decides when it applies.
 * Declaring keys here is what lets the settings listing show a shortcut whose feature is
 * not currently mounted, and what makes a key collision a static fact rather than
 * something that depends on which mode the app happens to be in.
 */

export type KeybindingGroup = 'Camera' | 'Editing' | 'Selection' | 'Transform' | 'View'

interface BaseKeybinding {
	/** Stable across rebinds and across changes to the wording. Keys the stored overrides. */
	id: string
	description: string
	group: KeybindingGroup
}

/** Dispatched on keydown by `KeyboardBindings`, through the registry in `useHotkeys`. */
export interface HotkeyKeybinding extends BaseKeybinding {
	kind: 'hotkey'
	/** Default `KeyboardEvent.key`, lowercased. */
	key: string
	/**
	 * Whether held Shift is part of the binding. Shift is the only modifier the registry
	 * takes: the command key belongs to the browser, and Option rewrites the character
	 * macOS reports, so an Option binding would have to be matched by `code` instead.
	 *
	 * A binding without it never fires while Shift is held, so `h` and `Shift+H` stay
	 * separate shortcuts.
	 */
	shift?: boolean
}

/**
 * Polled every frame by `InputBindings`. Separate from a hotkey because holding the key has
 * to keep moving the camera rather than fire once.
 */
export interface CameraKeybinding extends BaseKeybinding {
	kind: 'camera'
	/** Default `KeyboardEvent.key`, lowercased. */
	key: string
}

/**
 * Implemented by its own handler and listed for discoverability only.
 *
 * These are the conventions a user already expects to work, so nothing is gained by letting
 * them move. Leaving them off the listing would read as "unsupported" rather than "not
 * configurable", which is why they are here at all.
 */
export interface FixedKeybinding extends BaseKeybinding {
	kind: 'fixed'
	/** Keys in press order. `Mod` renders as the platform's command or control key. */
	combo: readonly string[]
}

export type Keybinding = CameraKeybinding | FixedKeybinding | HotkeyKeybinding

export const KEYBINDINGS = {
	cameraForward: {
		id: 'camera.forward',
		kind: 'camera',
		key: 'w',
		description: 'Move forward',
		group: 'Camera',
	},
	cameraBackward: {
		id: 'camera.backward',
		kind: 'camera',
		key: 's',
		description: 'Move backward',
		group: 'Camera',
	},
	cameraTruckLeft: {
		id: 'camera.truckLeft',
		kind: 'camera',
		key: 'a',
		description: 'Move left',
		group: 'Camera',
	},
	cameraTruckRight: {
		id: 'camera.truckRight',
		kind: 'camera',
		key: 'd',
		description: 'Move right',
		group: 'Camera',
	},
	cameraDollyIn: {
		id: 'camera.dollyIn',
		kind: 'camera',
		key: 'e',
		description: 'Move toward the target',
		group: 'Camera',
	},
	cameraDollyOut: {
		id: 'camera.dollyOut',
		kind: 'camera',
		key: 'q',
		description: 'Move away from the target',
		group: 'Camera',
	},
	cameraRotateLeft: {
		id: 'camera.rotateLeft',
		kind: 'camera',
		key: 'arrowleft',
		description: 'Orbit left',
		group: 'Camera',
	},
	cameraRotateRight: {
		id: 'camera.rotateRight',
		kind: 'camera',
		key: 'arrowright',
		description: 'Orbit right',
		group: 'Camera',
	},
	cameraTiltUp: {
		id: 'camera.tiltUp',
		kind: 'camera',
		key: 'arrowup',
		description: 'Orbit up',
		group: 'Camera',
	},
	cameraTiltDown: {
		id: 'camera.tiltDown',
		kind: 'camera',
		key: 'arrowdown',
		description: 'Orbit down',
		group: 'Camera',
	},
	focusSelection: {
		id: 'camera.focusSelection',
		kind: 'hotkey',
		key: 'f',
		description: 'Focus object',
		group: 'Camera',
	},
	toggleProjection: {
		id: 'camera.toggleProjection',
		kind: 'hotkey',
		key: 'c',
		description: 'Toggle camera projection',
		group: 'Camera',
	},

	transformNone: {
		id: 'transform.none',
		kind: 'hotkey',
		key: '0',
		description: 'No transform controls',
		group: 'Transform',
	},
	transformTranslate: {
		id: 'transform.translate',
		kind: 'hotkey',
		key: '1',
		description: 'Translate',
		group: 'Transform',
	},
	transformRotate: {
		id: 'transform.rotate',
		kind: 'hotkey',
		key: '2',
		description: 'Rotate',
		group: 'Transform',
	},
	transformScale: {
		id: 'transform.scale',
		kind: 'hotkey',
		key: '3',
		description: 'Scale',
		group: 'Transform',
	},

	isolateSelection: {
		id: 'view.isolateSelection',
		kind: 'hotkey',
		key: '/',
		description: 'Isolate selection',
		group: 'View',
	},
	toggleSelectionVisibility: {
		id: 'view.toggleSelectionVisibility',
		kind: 'hotkey',
		key: 'h',
		description: 'Hide or show the selection',
		group: 'View',
	},
	showAllHidden: {
		id: 'view.showAllHidden',
		kind: 'hotkey',
		key: 'h',
		shift: true,
		description: 'Show every hidden object',
		group: 'View',
	},

	addToSelection: {
		id: 'selection.addToSelection',
		kind: 'fixed',
		combo: ['Shift'],
		description: 'Hold while dragging a lasso to add to the selection',
		group: 'Selection',
	},

	undo: {
		id: 'editing.undo',
		kind: 'fixed',
		combo: ['Mod', 'z'],
		description: 'Undo the last frame edit',
		group: 'Editing',
	},
	redo: {
		id: 'editing.redo',
		kind: 'fixed',
		combo: ['Mod', 'Shift', 'z'],
		description: 'Redo the last undone frame edit',
		group: 'Editing',
	},
	save: {
		id: 'editing.save',
		kind: 'fixed',
		combo: ['Mod', 's'],
		description: 'Save staged frame edits',
		group: 'Editing',
	},
} as const satisfies Record<string, Keybinding>

/** Every catalogued binding, in declaration order. */
export const ALL_KEYBINDINGS: readonly Keybinding[] = Object.values(KEYBINDINGS)

const lookupKey = (key: string, shift: boolean) => `${key.toLowerCase()}:${shift}`

const hotkeysByKey = new Map(
	ALL_KEYBINDINGS.filter((binding) => binding.kind === 'hotkey').map((binding) => [
		lookupKey(binding.key, binding.shift ?? false),
		binding,
	])
)

/**
 * The hotkey a keypress selects, or `undefined` when nothing is bound to it. Camera
 * bindings are excluded: they are polled per frame rather than dispatched on keydown.
 */
export const getHotkeyForKey = (key: string, shift = false): HotkeyKeybinding | undefined => {
	return hotkeysByKey.get(lookupKey(key, shift))
}
