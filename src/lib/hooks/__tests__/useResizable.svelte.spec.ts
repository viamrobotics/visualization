import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
import ResizableTestWrapper from './fixtures/ResizableTestWrapper.svelte'

const mockStorage = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
	get: vi.fn((key: string) => Promise.resolve(mockStorage.get(key))),
	set: vi.fn((key: string, value: unknown) => {
		mockStorage.set(key, value)
		return Promise.resolve()
	}),
}))

type ResizeCallback = ResizeObserverCallback
let resizeCallback: ResizeCallback | undefined

vi.stubGlobal(
	'ResizeObserver',
	vi.fn((callback: ResizeCallback) => {
		resizeCallback = callback
		return {
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		}
	})
)

const simulateResize = (target: Element, width: number, height: number) => {
	resizeCallback?.(
		[
			{
				target,
				contentRect: { width, height } as DOMRectReadOnly,
				borderBoxSize: [],
				contentBoxSize: [],
				devicePixelContentBoxSize: [],
			},
		],
		{} as ResizeObserver
	)
}

describe('useResizable', () => {
	beforeEach(() => {
		mockStorage.clear()
		resizeCallback = undefined
		vi.clearAllMocks()
	})

	describe('loading state', () => {
		it('shows loading initially, then loaded after storage check', async () => {
			render(ResizableTestWrapper, { name: 'test' })

			// Should show loaded after async storage check completes
			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})
		})
	})

	describe('dimensions', () => {
		it('displays default dimensions when no saved data exists', async () => {
			render(ResizableTestWrapper, { name: 'empty' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			expect(screen.getByTestId('dimensions')).toHaveTextContent('240x320')
		})

		it('displays saved dimensions from storage', async () => {
			mockStorage.set('saved-resizable', { width: 400, height: 600 })

			render(ResizableTestWrapper, { name: 'saved' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			expect(screen.getByTestId('dimensions')).toHaveTextContent('400x600')
		})
	})

	describe('resize persistence', () => {
		it('saves dimensions to storage when container is resized', async () => {
			const { set } = await import('idb-keyval')

			render(ResizableTestWrapper, { name: 'resize-test' })

			await waitFor(() => {
				expect(screen.getByTestId('status')).toHaveTextContent('loaded')
			})

			const container = screen.getByTestId('container')

			// Simulate resize
			simulateResize(container, 500, 700)

			expect(set).toHaveBeenCalledWith('resize-test-resizable', {
				width: 500,
				height: 700,
			})
		})
	})
})
