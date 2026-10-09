import { describe, expect, it, vi } from 'vitest'

import type { HotkeyKeybinding } from '#lib/keybindings/index.js'

import { createKeybindings } from '#lib/keybindings/index.js'

const hotkey = (
	id: string,
	key: string,
	modifiers: { shift?: boolean; mod?: boolean } = {}
): HotkeyKeybinding => ({
	id,
	kind: 'hotkey',
	key,
	...modifiers,
	description: id,
	group: 'View',
})

const press = (key: string, modifiers: { shift?: boolean; mod?: boolean } = {}) => ({
	key,
	shift: modifiers.shift ?? false,
	mod: modifiers.mod ?? false,
})

describe('keybinding registry', () => {
	it('lists a binding while it is registered', () => {
		const keybindings = createKeybindings()
		const binding = hotkey('a', 'a')

		const release = keybindings.register(binding, { run: () => undefined })
		expect(keybindings.bindings).toEqual([binding])

		release()
		expect(keybindings.bindings).toEqual([])
	})

	it('lists a binding registered without a handler but never runs it', () => {
		const keybindings = createKeybindings()
		const binding = hotkey('listed', 'l')

		keybindings.register(binding)

		expect(keybindings.bindings).toEqual([binding])
		expect(keybindings.matching(press('l'))).toEqual([])
	})

	it('matches a press to its handler regardless of case', () => {
		const keybindings = createKeybindings()
		const handler = { run: vi.fn() }
		const binding = hotkey('c', 'c')

		keybindings.register(binding, handler)

		expect(keybindings.matching(press('C'))).toEqual([{ binding, handler }])
	})

	it('keeps a shifted press separate from an unshifted one', () => {
		const keybindings = createKeybindings()
		const plain = { run: vi.fn() }
		const shifted = { run: vi.fn() }

		keybindings.register(hotkey('hide', 'h'), plain)
		keybindings.register(hotkey('show-all', 'h', { shift: true }), shifted)

		expect(keybindings.matching(press('h'))[0]?.handler).toBe(plain)
		expect(keybindings.matching(press('H', { shift: true }))[0]?.handler).toBe(shifted)
	})

	it('keeps a modified press separate from an unmodified one', () => {
		const keybindings = createKeybindings()
		const plain = { run: vi.fn() }
		const modified = { run: vi.fn() }

		keybindings.register(hotkey('select-mode', 's'), plain)
		keybindings.register(hotkey('save', 's', { mod: true }), modified)

		expect(keybindings.matching(press('s'))[0]?.handler).toBe(plain)
		expect(keybindings.matching(press('s', { mod: true }))[0]?.handler).toBe(modified)
	})

	it('distinguishes redo from undo by the shift qualifier', () => {
		const keybindings = createKeybindings()
		const undo = { run: vi.fn() }
		const redo = { run: vi.fn() }

		keybindings.register(hotkey('undo', 'z', { mod: true }), undo)
		keybindings.register(hotkey('redo', 'z', { mod: true, shift: true }), redo)

		expect(keybindings.matching(press('z', { mod: true }))[0]?.handler).toBe(undo)
		expect(keybindings.matching(press('z', { mod: true, shift: true }))[0]?.handler).toBe(redo)
	})

	it('matches nothing for an unbound press', () => {
		const keybindings = createKeybindings()

		keybindings.register(hotkey('c', 'c'), { run: () => undefined })

		expect(keybindings.matching(press('j'))).toEqual([])
	})

	// Hosts compose their own plugin set, so two plugins claiming one press is a runtime
	// fact. Nothing static can rule it out.
	it('warns when two bindings claim the same press', () => {
		const keybindings = createKeybindings()
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		keybindings.register(hotkey('first', 'x'), { run: () => undefined })
		keybindings.register(hotkey('second', 'x'), { run: () => undefined })

		expect(warn).toHaveBeenCalledWith(expect.stringContaining('"second" and "first"'))
	})

	it('does not warn when the shift qualifier differs', () => {
		const keybindings = createKeybindings()
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		keybindings.register(hotkey('plain', 'h'), { run: () => undefined })
		keybindings.register(hotkey('shifted', 'h', { shift: true }), { run: () => undefined })

		expect(warn).not.toHaveBeenCalled()
	})
})
