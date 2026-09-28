import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { HotkeyKeybinding } from '$lib/keybindings'

import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import { createKeybindings, KEYBINDINGS_CONTEXT_KEY } from '$lib/keybindings'

import KeyboardBindings from '../KeyboardBindings.svelte'

const TOGGLE_PROJECTION: HotkeyKeybinding = {
	id: 'camera.toggleProjection',
	kind: 'hotkey',
	key: 'c',
	description: 'Toggle camera projection',
	group: 'Camera',
}

const SHOW_ALL_HIDDEN: HotkeyKeybinding = {
	id: 'view.showAllHidden',
	kind: 'hotkey',
	key: 'h',
	shift: true,
	description: 'Show every hidden object',
	group: 'View',
}

const renderExecutor = () => {
	const environment = createEnvironment()
	const keybindings = createKeybindings()

	render(KeyboardBindings, {
		context: new Map<symbol, unknown>([
			[ENVIRONMENT_CONTEXT_KEY, environment],
			[KEYBINDINGS_CONTEXT_KEY, keybindings],
		]),
	})

	return { environment, keybindings }
}

describe('KeyboardBindings executor', () => {
	it('runs an applicable handler when the binding key is pressed', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		await user.keyboard('c')

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('matches keys case-insensitively', () => {
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }))

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('ignores a key no binding claims', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		await user.keyboard('j')

		expect(run).not.toHaveBeenCalled()
	})

	it('ignores a camera key, which InputBindings polls instead', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		await user.keyboard(KEYBINDINGS.cameraForward.key)

		expect(run).not.toHaveBeenCalled()
	})

	it('dispatches a shifted press to its own binding', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const toggle = vi.fn()
		const showAll = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleSelectionVisibility, { run: toggle })
		hotkeys.register(KEYBINDINGS.showAllHidden, { run: showAll })
		await user.keyboard('{Shift>}h{/Shift}')

		expect(showAll).toHaveBeenCalledTimes(1)
		expect(toggle).not.toHaveBeenCalled()
	})

	it('consults when() at dispatch time', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()
		let applicable = false

		hotkeys.register(KEYBINDINGS.toggleProjection, { when: () => applicable, run })

		await user.keyboard('c')
		expect(run).not.toHaveBeenCalled()

		applicable = true
		await user.keyboard('c')
		expect(run).toHaveBeenCalledTimes(1)
	})

	it('ignores keys typed into an editable element', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()
		const input = document.createElement('input')
		document.body.append(input)

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		input.focus()
		await user.keyboard('c')

		expect(run).not.toHaveBeenCalled()
		expect(input.value).toBe('c')
		input.remove()
	})

	it('ignores presses while a modifier is held', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		await user.keyboard('{Meta>}c{/Meta}')

		expect(run).not.toHaveBeenCalled()
	})

	it('ignores the repeated events of a held key', () => {
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		// userEvent cannot express auto-repeat, so dispatch the raw event.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', repeat: true }))

		expect(run).not.toHaveBeenCalled()
	})

	it('stops dispatching while input bindings are disabled', async () => {
		const user = userEvent.setup()
		const { environment, hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run })
		environment.current.inputBindingsEnabled = false
		await user.keyboard('c')

		expect(run).not.toHaveBeenCalled()
	})

	it('runs every handler for one binding and warns that two components implement it', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const warn = vi.spyOn(console, 'warn')
		const first = vi.fn()
		const second = vi.fn()

		hotkeys.register(KEYBINDINGS.toggleProjection, { run: first })
		hotkeys.register(KEYBINDINGS.toggleProjection, { run: second })
		await user.keyboard('c')

		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('2 components implement "camera.toggleProjection"')
		)
	})
})
