import type { ResourceName } from '@viamrobotics/sdk'

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePartID } from '$lib/hooks/usePartID.svelte'

import ResourceWidgetPanel from '../ResourceWidgetPanel.svelte'
import { useControlWidgets } from '../useControlWidgets.svelte'
import DummyWidget from './__fixtures__/DummyWidget.svelte'

vi.mock('$lib/components/overlay/FloatingPanel.svelte', async () => {
	const MockFloatingPanel = await import('./__fixtures__/MockFloatingPanel.svelte')
	return { default: MockFloatingPanel.default }
})

vi.mock('@threlte/core', () => ({
	useThrelte: () => ({ dom: { clientWidth: 1000, clientHeight: 800 } }),
}))

vi.mock('$lib/hooks/usePartID.svelte', () => ({ usePartID: vi.fn() }))
vi.mock('../useControlWidgets.svelte', () => ({ useControlWidgets: vi.fn() }))

describe('ResourceWidgetPanel', () => {
	const partID = 'part1'
	const resource = {
		namespace: 'rdk',
		type: 'component',
		subtype: 'arm',
		name: 'arm1',
	} as ResourceName

	const mockPartID = { current: partID }
	const setOpen = vi.fn()
	const store = {
		openFor: vi.fn(() => []),
		isOpen: vi.fn(() => false),
		setOpen,
		rectFor: vi.fn(() => undefined),
		saveRect: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useControlWidgets).mockReturnValue(store as never)
		vi.mocked(usePartID).mockReturnValue(mockPartID as never)
	})

	it('renders the provided widget components with the resource name', () => {
		render(ResourceWidgetPanel, {
			props: {
				resource,
				widgetId: 'is-moving',
				widgets: [DummyWidget],
				title: 'arm1 · IsMoving',
				stackIndex: 0,
			},
		})

		expect(screen.getByText('dummy:part1:arm1')).toBeInTheDocument()
	})

	it('closes by removing its own (resource, widget) entry from the store', async () => {
		render(ResourceWidgetPanel, {
			props: {
				resource,
				widgetId: 'is-moving',
				widgets: [DummyWidget],
				title: 'arm1 · IsMoving',
				stackIndex: 0,
			},
		})

		await fireEvent.click(screen.getByRole('button', { name: /close panel/i }))

		await waitFor(() => {
			expect(setOpen).toHaveBeenCalledWith(partID, 'arm1', 'is-moving', false)
		})
	})
})
