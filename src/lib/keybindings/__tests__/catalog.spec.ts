import { describe, expect, it } from 'vitest'

import { ALL_KEYBINDINGS, getHotkeyForKey, KEYBINDINGS } from '$lib/keybindings'

describe('keybinding catalog', () => {
	it('gives every binding a unique id', () => {
		const ids = ALL_KEYBINDINGS.map((binding) => binding.id)

		expect(new Set(ids).size).toBe(ids.length)
	})

	// Availability is a per-action precondition now, never a mode, so nothing decides
	// between two bindings that want the same press. One press, one action.
	it('gives every rebindable binding a unique press', () => {
		const presses = ALL_KEYBINDINGS.filter((binding) => binding.kind !== 'fixed').map(
			(binding) => `${binding.key}:${binding.kind === 'hotkey' && binding.shift}`
		)

		expect(new Set(presses).size).toBe(presses.length)
	})

	// The camera poll reads the raw key and cannot see Shift, so a hotkey sharing a camera
	// key would fire while the camera also moved.
	it('keeps hotkey and camera keys apart', () => {
		const cameraKeys = new Set(
			ALL_KEYBINDINGS.filter((binding) => binding.kind === 'camera').map((binding) => binding.key)
		)
		const hotkeyKeys = ALL_KEYBINDINGS.filter((binding) => binding.kind === 'hotkey').map(
			(binding) => binding.key
		)

		expect(hotkeyKeys.filter((key) => cameraKeys.has(key))).toEqual([])
	})

	it('stores every key lowercased, which is how a press is looked up', () => {
		for (const binding of ALL_KEYBINDINGS) {
			if (binding.kind === 'fixed') continue

			expect(binding.key).toBe(binding.key.toLowerCase())
		}
	})

	it('resolves a press to its hotkey regardless of case', () => {
		expect(getHotkeyForKey('C')).toBe(KEYBINDINGS.toggleProjection)
		expect(getHotkeyForKey('c')).toBe(KEYBINDINGS.toggleProjection)
	})

	it('treats a shifted press as its own binding', () => {
		expect(getHotkeyForKey('h')).toBe(KEYBINDINGS.toggleSelectionVisibility)
		expect(getHotkeyForKey('H', true)).toBe(KEYBINDINGS.showAllHidden)
	})

	it('does not resolve an unshifted binding while Shift is held', () => {
		expect(getHotkeyForKey('c', true)).toBeUndefined()
	})

	it('does not resolve a camera key, which is polled rather than dispatched', () => {
		expect(getHotkeyForKey(KEYBINDINGS.cameraForward.key)).toBeUndefined()
	})

	it('does not resolve an unbound key', () => {
		expect(getHotkeyForKey('j')).toBeUndefined()
	})
})
