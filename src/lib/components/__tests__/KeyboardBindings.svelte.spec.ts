import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import { createHotkeys, HOTKEYS_CONTEXT_KEY } from '$lib/hooks/useHotkeys.svelte'

import KeyboardBindings from '../KeyboardBindings.svelte'

const renderExecutor = () => {
	const environment = createEnvironment()
	const hotkeys = createHotkeys()

	render(KeyboardBindings, {
		context: new Map<symbol, unknown>([
			[ENVIRONMENT_CONTEXT_KEY, environment],
			[HOTKEYS_CONTEXT_KEY, hotkeys],
		]),
	})

	return { environment, hotkeys }
}

describe('KeyboardBindings executor', () => {
	it('runs an applicable binding when its key is pressed', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register({ key: 'c', description: 'test', run })
		await user.keyboard('c')

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('matches keys case-insensitively', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register({ key: 'C', description: 'test', run })
		await user.keyboard('c')

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('consults when() at dispatch time', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const run = vi.fn()
		let applicable = false

		hotkeys.register({ key: 'c', description: 'test', when: () => applicable, run })

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

		hotkeys.register({ key: 'c', description: 'test', run })
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

		hotkeys.register({ key: 'c', description: 'test', run })
		await user.keyboard('{Meta>}c{/Meta}')

		expect(run).not.toHaveBeenCalled()
	})

	it('ignores the repeated events of a held key', () => {
		const { hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register({ key: 'c', description: 'test', run })
		// userEvent cannot express auto-repeat, so dispatch the raw event.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', repeat: true }))

		expect(run).not.toHaveBeenCalled()
	})

	it('stops dispatching while input bindings are disabled', async () => {
		const user = userEvent.setup()
		const { environment, hotkeys } = renderExecutor()
		const run = vi.fn()

		hotkeys.register({ key: 'c', description: 'test', run })
		environment.current.inputBindingsEnabled = false
		await user.keyboard('c')

		expect(run).not.toHaveBeenCalled()
	})

	it('runs every applicable binding on a shared key and warns about the collision', async () => {
		const user = userEvent.setup()
		const { hotkeys } = renderExecutor()
		const warn = vi.spyOn(console, 'warn')
		const first = vi.fn()
		const second = vi.fn()

		hotkeys.register({ key: 'x', description: 'first', run: first })
		hotkeys.register({ key: 'x', description: 'second', run: second })
		await user.keyboard('x')

		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('2 bindings apply to "x"'))
	})
})
