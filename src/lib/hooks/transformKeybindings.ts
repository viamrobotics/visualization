import type { HotkeyKeybinding } from '#lib/keybindings/index.js'

import type { TransformGizmoMode } from './useTransformGizmos.svelte'

/**
 * The shortcuts that pick a transform gizmo's mode, declared here rather than at a call
 * site because three places need them: the gizmo registry registers them, and both the
 * build and move dashboards print them on their buttons.
 */
export const TRANSFORM_KEYBINDINGS: Record<TransformGizmoMode, HotkeyKeybinding> = {
	none: {
		id: 'transform.none',
		kind: 'hotkey',
		key: '0',
		description: 'No transform controls',
		group: 'Transform',
	},
	translate: {
		id: 'transform.translate',
		kind: 'hotkey',
		key: '1',
		description: 'Translate',
		group: 'Transform',
	},
	rotate: {
		id: 'transform.rotate',
		kind: 'hotkey',
		key: '2',
		description: 'Rotate',
		group: 'Transform',
	},
	scale: {
		id: 'transform.scale',
		kind: 'hotkey',
		key: '3',
		description: 'Scale',
		group: 'Transform',
	},
}
