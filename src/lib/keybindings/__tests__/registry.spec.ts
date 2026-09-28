import type { HotkeyKeybinding } from '$lib/keybindings'

import { describe, expect, it, vi } from 'vitest'

import { createKeybindings } from '$lib/keybindings'

const hotkey = (id: string, key: string, shift = false): HotkeyKeybinding => ({
	id,
	kind: 'hotkey',
	key,
	shift,
	description: id,
	group: 'View',
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

	it('lists a binding registered without a handler', () => {
		const keybindings = createKeybindings()
		const binding: HotkeyKeybinding = hotkey('listed', 'l')

		keybindings.register(binding)

		expect(keybindings.bindings).toEqual([binding])
		expect(keybindings.handlersFor('l', false)).toEqual([])
	})

	it('resolves a press to its handler regardless of case', () => {
		const keybindings = createKeybindings()
		const handler = { run: vi.fn() }

		keybindings.register(hotkey('c', 'c'), handler)

		expect(keybindings.handlersFor('C', false)).toEqual([handler])
	})

	it('keeps a shifted press separate from an unshifted one', () => {
		const keybindings = createKeybindings()
		const plain = { run: vi.fn() }
		const shifted = { run: vi.fn() }

		keybindings.register(hotkey('hide', 'h'), plain)
		keybindings.register(hotkey('show-all', 'h', true), shifted)

		expect(keybindings.handlersFor('h', false)).toEqual([plain])
		expect(keybindings.handlersFor('H', true)).toEqual([shifted])
	})

	it('resolves nothing for an unbound press', () => {
		const keybindings = createKeybindings()

		keybindings.register(hotkey('c', 'c'), { run: () => undefined })

		expect(keybindings.handlersFor('j', false)).toEqual([])
	})

	// Hosts compose their own plugin set, so two plugins claiming one key is a runtime
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
		keybindings.register(hotkey('shifted', 'h', true), { run: () => undefined })

		expect(warn).not.toHaveBeenCalled()
	})
})
