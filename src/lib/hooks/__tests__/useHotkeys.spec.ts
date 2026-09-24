import { describe, expect, it } from 'vitest'

import { createHotkeys, type HotkeyBinding } from '$lib/hooks/useHotkeys.svelte'

const binding = (key: string): HotkeyBinding => ({
	key,
	description: `binding for ${key}`,
	run: () => undefined,
})

describe('createHotkeys registry', () => {
	it('stores bindings under their lowercased key', () => {
		const hotkeys = createHotkeys()
		const registered = binding('C')

		hotkeys.register(registered)

		expect([...(hotkeys.bindings.get('c') ?? [])]).toEqual([registered])
		expect(hotkeys.bindings.has('C')).toBe(false)
	})

	it('keeps other bindings on the same key when one is released', () => {
		const hotkeys = createHotkeys()
		const first = binding('x')
		const second = binding('x')

		const release = hotkeys.register(first)
		hotkeys.register(second)
		release()

		expect([...(hotkeys.bindings.get('x') ?? [])]).toEqual([second])
	})

	it('drops the key once its last binding is released', () => {
		const hotkeys = createHotkeys()

		const release = hotkeys.register(binding('x'))
		release()

		expect(hotkeys.bindings.has('x')).toBe(false)
	})

	it('ignores a release called more than once', () => {
		const hotkeys = createHotkeys()
		const stale = binding('x')

		const release = hotkeys.register(stale)
		release()
		hotkeys.register(stale)
		release()

		expect(hotkeys.bindings.get('x')?.has(stale)).toBe(true)
	})
})
