import { describe, expect, it } from 'vitest'

import { createHotkeys, type HotkeyHandler } from '$lib/hooks/useHotkeys.svelte'
import { KEYBINDINGS } from '$lib/keybindings'

const handler = (): HotkeyHandler => ({ run: () => undefined })

describe('createHotkeys registry', () => {
	it('stores handlers under the binding id', () => {
		const hotkeys = createHotkeys()
		const registered = handler()

		hotkeys.register(KEYBINDINGS.toggleProjection, registered)

		expect([...(hotkeys.handlers.get('camera.toggleProjection') ?? [])]).toEqual([registered])
	})

	it('keeps other handlers for the same binding when one is released', () => {
		const hotkeys = createHotkeys()
		const first = handler()
		const second = handler()

		const release = hotkeys.register(KEYBINDINGS.isolateSelection, first)
		hotkeys.register(KEYBINDINGS.isolateSelection, second)
		release()

		expect([...(hotkeys.handlers.get('view.isolateSelection') ?? [])]).toEqual([second])
	})

	it('drops the binding once its last handler is released', () => {
		const hotkeys = createHotkeys()

		const release = hotkeys.register(KEYBINDINGS.isolateSelection, handler())
		release()

		expect(hotkeys.handlers.has('view.isolateSelection')).toBe(false)
	})

	it('ignores a release called more than once', () => {
		const hotkeys = createHotkeys()
		const stale = handler()

		const release = hotkeys.register(KEYBINDINGS.isolateSelection, stale)
		release()
		hotkeys.register(KEYBINDINGS.isolateSelection, stale)
		release()

		expect(hotkeys.handlers.get('view.isolateSelection')?.has(stale)).toBe(true)
	})
})
