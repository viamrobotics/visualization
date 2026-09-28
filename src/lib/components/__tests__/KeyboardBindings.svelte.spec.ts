import type { CameraKeybinding, HotkeyKeybinding } from '$lib/keybindings'

import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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

const TOGGLE_VISIBILITY: HotkeyKeybinding = {
	id: 'view.toggleSelectionVisibility',
	kind: 'hotkey',
	key: 'h',
	description: 'Hide or show the selection',
	group: 'View',
}

const SHOW_ALL_HIDDEN: HotkeyKeybinding = {
	id: 'view.showAllHidden',
	kind: 'hotkey',
	key: 'h',
	shift: true,
	description: 'Show every hidden object',
	group: 'View',
}

const CAMERA_FORWARD: CameraKeybinding = {
	id: 'camera.forward',
	kind: 'camera',
	key: 'w',
	description: 'Move forward',
	group: 'Camera',
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
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		await user.keyboard('c')

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('matches keys case-insensitively', () => {
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }))

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('ignores a key no binding claims', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		await user.keyboard('j')

		expect(run).not.toHaveBeenCalled()
	})

	it('never dispatches a camera binding, which InputBindings polls instead', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(CAMERA_FORWARD, { run })
		await user.keyboard('w')

		expect(run).not.toHaveBeenCalled()
	})

	it('dispatches a shifted press to its own binding', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const toggle = vi.fn()
		const showAll = vi.fn()

		keybindings.register(TOGGLE_VISIBILITY, { run: toggle })
		keybindings.register(SHOW_ALL_HIDDEN, { run: showAll })
		await user.keyboard('{Shift>}h{/Shift}')

		expect(showAll).toHaveBeenCalledTimes(1)
		expect(toggle).not.toHaveBeenCalled()
	})

	it('consults when() at dispatch time', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const run = vi.fn()
		let applicable = false

		keybindings.register(TOGGLE_PROJECTION, { when: () => applicable, run })

		await user.keyboard('c')
		expect(run).not.toHaveBeenCalled()

		applicable = true
		await user.keyboard('c')
		expect(run).toHaveBeenCalledTimes(1)
	})

	it('ignores keys typed into an editable element', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const run = vi.fn()
		const input = document.createElement('input')
		document.body.append(input)

		keybindings.register(TOGGLE_PROJECTION, { run })
		input.focus()
		await user.keyboard('c')

		expect(run).not.toHaveBeenCalled()
		expect(input.value).toBe('c')
		input.remove()
	})

	it('ignores presses while a modifier is held', async () => {
		const user = userEvent.setup()
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		await user.keyboard('{Meta>}c{/Meta}')

		expect(run).not.toHaveBeenCalled()
	})

	it('ignores the repeated events of a held key', () => {
		const { keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		// userEvent cannot express auto-repeat, so dispatch the raw event.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', repeat: true }))

		expect(run).not.toHaveBeenCalled()
	})

	it('stops dispatching while input bindings are disabled', async () => {
		const user = userEvent.setup()
		const { environment, keybindings } = renderExecutor()
		const run = vi.fn()

		keybindings.register(TOGGLE_PROJECTION, { run })
		environment.current.inputBindingsEnabled = false
		await user.keyboard('c')

		expect(run).not.toHaveBeenCalled()
	})
})
