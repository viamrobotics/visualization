import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { ObstaclePreviewController } from '../ObstaclePreviewController'

const DELAY_MS = 250

const box = (x: number): ObstacleGeometryConfig[] => [
	{ label: 'shape', type: 'box', x: 10, y: 10, z: x },
]

describe('ObstaclePreviewController', () => {
	let send: ReturnType<typeof vi.fn<(name: string, geometries: ObstacleGeometryConfig[]) => void>>
	let controller: ObstaclePreviewController

	beforeEach(() => {
		vi.useFakeTimers()
		send = vi.fn()
		controller = new ObstaclePreviewController(send, DELAY_MS)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('sends nothing for a clean first update', () => {
		controller.update({ wall: box(1) }, false)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('sends an edit once after the delay', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		vi.advanceTimersByTime(DELAY_MS - 1)
		expect(send).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(send).toHaveBeenCalledExactlyOnceWith('wall', box(2))
	})

	it('collapses rapid edits into one send of the latest geometries', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		vi.advanceTimersByTime(DELAY_MS - 1)
		controller.update({ wall: box(3) }, true)
		vi.advanceTimersByTime(DELAY_MS - 1)
		expect(send).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(send).toHaveBeenCalledExactlyOnceWith('wall', box(3))
	})

	it('sends nothing when edited back to the received geometries before the delay', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		controller.update({ wall: box(1) }, true)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('ignores object key order when comparing', () => {
		controller.update({ wall: [{ label: 'shape', type: 'box', x: 1, y: 2, z: 3 }] }, false)
		controller.update({ wall: [{ z: 3, y: 2, x: 1, type: 'box', label: 'shape' }] }, true)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('sends the saved geometries back on discard', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		vi.advanceTimersByTime(DELAY_MS)
		controller.update({ wall: box(1) }, false)
		vi.advanceTimersByTime(DELAY_MS)
		expect(send).toHaveBeenCalledTimes(2)
		expect(send).toHaveBeenLastCalledWith('wall', box(1))
	})

	it('sends nothing on save', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		vi.advanceTimersByTime(DELAY_MS)
		send.mockClear()
		controller.update({ wall: box(2) }, false)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('sends the draft on a dirty first update', () => {
		controller.update({ wall: box(2) }, true)
		vi.advanceTimersByTime(DELAY_MS)
		expect(send).toHaveBeenCalledExactlyOnceWith('wall', box(2))
	})

	it('records a clean new obstacle without sending it', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(1), fence: box(5) }, false)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('cancels a pending send on stop', () => {
		controller.update({ wall: box(1) }, false)
		controller.update({ wall: box(2) }, true)
		controller.stop()
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})

	it('treats the first update after stop as a fresh start', () => {
		controller.update({ wall: box(1) }, false)
		controller.stop()
		controller.update({ wall: box(2) }, false)
		vi.advanceTimersByTime(DELAY_MS * 2)
		expect(send).not.toHaveBeenCalled()
	})
})
