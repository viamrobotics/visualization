import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import MockCanvas from '$lib/__tests__/fixtures/MockCanvas.svelte'

import ConfirmFloatingPanel from '../ConfirmFloatingPanel.svelte'

// The globally mocked `@threlte/extras` (see vitest-setup-client.ts) reduces `HTML` to a
// no-op, so its children never mount and the buttons this spec queries for would never
// exist. Use the real `HTML`/`@threlte/core` under a `<Canvas>` fixture instead, mirroring
// wireframe.spec.ts's approach for the same problem.
vi.mock('@threlte/core', async () => {
	const actual = await vi.importActual('@threlte/core')
	return {
		...actual,
		currentWritable: vi.fn(() => ({
			subscribe: () => () => {},
			set: () => {},
			update: () => {},
		})),
	}
})

vi.mock('@threlte/extras', async () => {
	const actual = await vi.importActual('@threlte/extras')
	return actual
})

vi.mock('three', async () => {
	const actual = await vi.importActual('three')
	return {
		...actual,
		WebGLRenderer: vi.fn().mockImplementation(() => ({
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			domElement: {
				getContext: vi.fn().mockReturnValue({}),
			},
			dispose: vi.fn(),
		})),
	}
})

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const baseProps = {
	position: [0, 0, 0] as [number, number, number],
	canUndo: true,
	canConfirm: true,
	canCommitAndContinue: true,
}

const renderPanel = (overrides: Partial<typeof baseProps> & Record<string, unknown> = {}) =>
	render(MockCanvas, {
		child: ConfirmFloatingPanel,
		...baseProps,
		onConfirm: vi.fn<() => void>(),
		onCancel: vi.fn<() => void>(),
		onCommitAndContinue: vi.fn<() => void>(),
		onUndo: vi.fn<() => void>(),
		...overrides,
	})

describe('ConfirmFloatingPanel', () => {
	it('confirms the placement when Confirm is clicked', async () => {
		const onConfirm = vi.fn<() => void>()
		renderPanel({ onConfirm })

		await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

		expect(onConfirm).toHaveBeenCalledOnce()
	})

	it('cancels the tool when Cancel is clicked', async () => {
		const onCancel = vi.fn<() => void>()
		renderPanel({ onCancel })

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(onCancel).toHaveBeenCalledOnce()
	})

	it('commits and continues when the add-another button is clicked', async () => {
		const onCommitAndContinue = vi.fn<() => void>()
		renderPanel({ onCommitAndContinue })

		await userEvent.click(screen.getByRole('button', { name: 'Commit and add another point' }))

		expect(onCommitAndContinue).toHaveBeenCalledOnce()
	})

	it('undoes the last point when Undo is clicked', async () => {
		const onUndo = vi.fn<() => void>()
		renderPanel({ onUndo })

		await userEvent.click(screen.getByRole('button', { name: 'Undo last point' }))

		expect(onUndo).toHaveBeenCalledOnce()
	})

	it('does not invoke confirm when confirming is not yet possible', async () => {
		const onConfirm = vi.fn<() => void>()
		renderPanel({ canConfirm: false, onConfirm })

		await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

		expect(onConfirm).not.toHaveBeenCalled()
	})

	it('does not invoke undo when there is nothing placed yet', async () => {
		const onUndo = vi.fn<() => void>()
		renderPanel({ canUndo: false, onUndo })

		await userEvent.click(screen.getByRole('button', { name: 'Undo last point' }))

		expect(onUndo).not.toHaveBeenCalled()
	})

	it('groups the actions with an accessible name for what they confirm', () => {
		renderPanel()

		expect(screen.getByRole('group', { name: 'Confirm placement' })).toBeInTheDocument()
	})
})
