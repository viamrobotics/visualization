import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import { createObstacleLivePreviewHarness } from './__fixtures__/obstacleLivePreviewHarness.svelte'

vi.mock('#lib/hooks/useEnvironment.svelte.js', () => ({ useEnvironment: vi.fn() }))
vi.mock('#lib/hooks/usePartID.svelte.js', () => ({ usePartID: vi.fn() }))
vi.mock('#lib/hooks/useEventBus.js', () => ({
	useEventBus: () => ({ publish: vi.fn(), subscribe: vi.fn() }),
}))
vi.mock('@viamrobotics/svelte-sdk', () => ({
	createResourceClient: vi.fn(),
	useConnectionStatus: vi.fn(),
}))

const PREVIEW_DEBOUNCE_MS = 250

const wall = (z: number): ObstacleGeometryConfig[] => [
	{ label: 'wall', type: 'box', x: 10, y: 10, z },
]

describe('useObstacleLivePreview', () => {
	let disposeRoot: (() => void) | undefined

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		disposeRoot?.()
		disposeRoot = undefined
		vi.useRealTimers()
	})

	it('sends the saved geometries back when a previewed draft is discarded on leaving build mode', () => {
		const harness = createObstacleLivePreviewHarness('fence', wall(1))
		disposeRoot = harness.disposeRoot
		harness.edit(wall(2))
		vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS)

		harness.discardAndSwitchTo('monitor')

		expect(harness.sentGeometries()).toEqual([wall(2), wall(1)])
	})

	it('sends the saved geometries back when preview is turned off with the draft still unsaved', () => {
		const harness = createObstacleLivePreviewHarness('fence', wall(1))
		disposeRoot = harness.disposeRoot
		harness.edit(wall(2))
		vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS)

		harness.setPreviewEnabled(false)

		expect(harness.sentGeometries()).toEqual([wall(2), wall(1)])
	})

	it('sends nothing while preview is off', () => {
		const harness = createObstacleLivePreviewHarness('fence', wall(1))
		disposeRoot = harness.disposeRoot
		harness.setPreviewEnabled(false)

		harness.edit(wall(2))
		vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS)

		expect(harness.sentGeometries()).toEqual([])
	})
})
