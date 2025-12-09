import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(),
}))

import { useFileDrop } from '../useFileDrop.svelte'

describe('useFileDrop', () => {
	const mockOnError = vi.fn()
	const mockOnSuccess = vi.fn()
	const mockAddPoints = vi.fn()
	const mockAddMesh = vi.fn()

	const createFileDrop = () => useFileDrop(mockOnError, mockOnSuccess, mockAddPoints, mockAddMesh)

	// Helper to create a mock DragEvent (jsdom doesn't support DragEvent)
	const createDragEvent = (
		type: string,
		options: { relatedTarget?: EventTarget | null; dataTransfer?: DataTransfer | null } = {}
	) => {
		const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
		Object.defineProperty(event, 'relatedTarget', { value: options.relatedTarget ?? null })
		Object.defineProperty(event, 'dataTransfer', { value: options.dataTransfer ?? null })
		return event
	}

	// Helper to create a DataTransfer with files (jsdom doesn't support DataTransfer)
	const createDataTransferWithFiles = (files: File[]) => {
		return {
			files: files,
		} as unknown as DataTransfer
	}

	beforeEach(() => {
		vi.resetAllMocks()
	})

	describe('state transitions', () => {
		it('starts with inactive dropState', () => {
			const fileDrop = createFileDrop()
			expect(fileDrop.dropState).toBe('inactive')
		})

		it('transitions to hovering on dragenter', () => {
			const fileDrop = createFileDrop()

			fileDrop.ondragenter(createDragEvent('dragenter'))

			expect(fileDrop.dropState).toBe('hovering')
		})

		it('transitions to inactive on dragleave when leaving window', () => {
			const fileDrop = createFileDrop()
			fileDrop.ondragenter(createDragEvent('dragenter'))

			fileDrop.ondragleave(createDragEvent('dragleave', { relatedTarget: null }))

			expect(fileDrop.dropState).toBe('inactive')
		})

		it('stays hovering on dragleave when moving between elements', () => {
			const fileDrop = createFileDrop()
			fileDrop.ondragenter(createDragEvent('dragenter'))

			const mockElement = document.createElement('div')
			fileDrop.ondragleave(createDragEvent('dragleave', { relatedTarget: mockElement }))

			expect(fileDrop.dropState).toBe('hovering')
		})

		it('transitions to loading when processing valid files', () => {
			const fileDrop = createFileDrop()
			const file = new File(['{}'], 'snapshot_data.json')
			const dataTransfer = createDataTransferWithFiles([file])

			fileDrop.ondrop(createDragEvent('drop', { dataTransfer }))

			expect(fileDrop.dropState).toBe('loading')
		})
	})

	describe('event handling', () => {
		it('prevents default on dragenter', () => {
			const fileDrop = createFileDrop()
			const event = createDragEvent('dragenter')
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

			fileDrop.ondragenter(event)

			expect(preventDefaultSpy).toHaveBeenCalled()
		})

		it('prevents default on dragover', () => {
			const fileDrop = createFileDrop()
			const event = createDragEvent('dragover')
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

			fileDrop.ondragover(event)

			expect(preventDefaultSpy).toHaveBeenCalled()
		})

		it('prevents default on drop', () => {
			const fileDrop = createFileDrop()
			const event = createDragEvent('drop')
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

			fileDrop.ondrop(event)

			expect(preventDefaultSpy).toHaveBeenCalled()
		})

		it('does nothing when dataTransfer is null', () => {
			const fileDrop = createFileDrop()
			const event = createDragEvent('drop', { dataTransfer: null })

			fileDrop.ondrop(event)

			expect(mockOnError).not.toHaveBeenCalled()
		})

		it('calls onError for unsupported file extension', () => {
			const fileDrop = createFileDrop()
			const file = new File([''], 'document.txt')
			const dataTransfer = createDataTransferWithFiles([file])

			fileDrop.ondrop(createDragEvent('drop', { dataTransfer }))

			expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('files are supported'))
		})
	})
})
