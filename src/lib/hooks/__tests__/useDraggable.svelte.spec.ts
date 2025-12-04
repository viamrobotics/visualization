import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte'
import DraggableTestWrapper from './fixtures/DraggableTestWrapper.svelte'

const mockStore = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
	get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
	set: vi.fn((key: string, value: unknown) => {
		mockStore.set(key, value)
		return Promise.resolve()
	}),
}))

describe('useDraggable', () => {
	beforeEach(() => {
		mockStore.clear()
		vi.clearAllMocks()
	})

	describe('loading state', () => {
		it('shows loaded after storage check completes', async () => {
			render(DraggableTestWrapper, { name: 'test' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})
		})
	})

	describe('position', () => {
		it('displays default position when no saved data exists', async () => {
			render(DraggableTestWrapper, { name: 'empty' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			expect(screen.getByTestId('position')).toHaveTextContent('0,0')
		})

		it('displays saved position from storage', async () => {
			mockStore.set('saved-draggable', { x: 100, y: 200 })

			render(DraggableTestWrapper, { name: 'saved' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			expect(screen.getByTestId('position')).toHaveTextContent('100,200')
		})
	})

	describe('drag interaction', () => {
		it('saves position to storage on drag end', async () => {
			const { set } = await import('idb-keyval')

			render(DraggableTestWrapper, { name: 'drag-test' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			const draggable = screen.getByTestId('draggable')

			// Simulate drag start and end
			await fireEvent.mouseDown(draggable)
			await fireEvent.mouseUp(draggable)

			expect(set).toHaveBeenCalledWith('drag-test-draggable', { x: 0, y: 0 })
		})
	})
})
