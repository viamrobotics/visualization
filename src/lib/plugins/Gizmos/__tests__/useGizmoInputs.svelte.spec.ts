import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import { createHotkeys, HOTKEYS_CONTEXT_KEY } from '$lib/hooks/useHotkeys.svelte'

import { GizmoModes } from '../gizmos'
import GizmoInputsHost from './__fixtures__/GizmoInputsHost.svelte'

// The global `@threlte/core` mock has no `dom` field, and `useGizmoInputs` listens
// for `contextmenu` on it. A real element stands in for the canvas.
vi.mock('@threlte/core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@threlte/core')>()),
	useThrelte: vi.fn(() => ({ dom: document.createElement('div') })),
}))

// Registered after KeyboardBindings' own listener, so it observes whether that
// listener called preventDefault rather than user-event's own internal bookkeeping.
const captureKeydownDefaultPrevented = () => {
	let defaultPrevented = false
	window.addEventListener('keydown', (event) => {
		defaultPrevented = event.defaultPrevented
	})
	return () => defaultPrevented
}

const renderHost = (
	mode: (typeof GizmoModes)[keyof typeof GizmoModes],
	handlers: {
		onCancel?: ReturnType<typeof vi.fn<() => void>>
		onConfirm?: ReturnType<typeof vi.fn<() => void>>
		onCommitAndContinue?: ReturnType<typeof vi.fn<() => void>>
		onUndo?: ReturnType<typeof vi.fn<() => void>>
	} = {}
) =>
	render(GizmoInputsHost, {
		props: { mode, ...handlers },
		context: new Map<symbol, unknown>([
			[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
			[HOTKEYS_CONTEXT_KEY, createHotkeys()],
		]),
	})

describe('useGizmoInputs', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('runs the cancel handler on Escape while a tool is armed', async () => {
		const user = userEvent.setup()
		const onCancel = vi.fn<() => void>()

		renderHost(GizmoModes.CoordinateSystem, { onCancel })
		await user.keyboard('{Escape}')

		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it('does not run the cancel handler on Escape while idle', async () => {
		const user = userEvent.setup()
		const onCancel = vi.fn<() => void>()

		renderHost(GizmoModes.Idle, { onCancel })
		await user.keyboard('{Escape}')

		expect(onCancel).not.toHaveBeenCalled()
	})

	it('prevents the default action for Space but not for Enter', async () => {
		const user = userEvent.setup()
		renderHost(GizmoModes.CoordinateSystem, {
			onCommitAndContinue: vi.fn<() => void>(),
		})

		const spaceDefaultPrevented = captureKeydownDefaultPrevented()
		await user.keyboard(' ')

		expect(spaceDefaultPrevented()).toBe(true)

		const enterDefaultPrevented = captureKeydownDefaultPrevented()
		await user.keyboard('{Enter}')

		expect(enterDefaultPrevented()).toBe(false)
	})

	it('does not throw when a handler the caller omitted has its key pressed', async () => {
		const user = userEvent.setup()

		renderHost(GizmoModes.CoordinateSystem)

		await expect(user.keyboard('{Enter}')).resolves.not.toThrow()
		await expect(user.keyboard(' ')).resolves.not.toThrow()
		await expect(user.keyboard('{Backspace}')).resolves.not.toThrow()
		await expect(user.keyboard('{Escape}')).resolves.not.toThrow()
	})
})
