import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { createObstacleLivePreviewHarness } from './__fixtures__/obstacleLivePreviewHarness.svelte'

vi.mock('$lib/hooks/useEnvironment.svelte', () => ({ useEnvironment: vi.fn() }))
vi.mock('$lib/hooks/usePartID.svelte', () => ({ usePartID: vi.fn() }))
vi.mock('$lib/plugins/Logs/useLogs.svelte', () => ({ useLogs: vi.fn() }))
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
})
