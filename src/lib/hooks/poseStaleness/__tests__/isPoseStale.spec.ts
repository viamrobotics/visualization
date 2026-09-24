import { describe, expect, it } from 'vitest'

import { isPoseStale, STALE_AFTER_MS } from '../isPoseStale'

const START = 1_000_000
const INTERVAL = 1000
const GAP = INTERVAL + STALE_AFTER_MS

const freshness = (overrides: Partial<Parameters<typeof isPoseStale>[0]> = {}) => ({
	now: START,
	lastPoseAt: START,
	pollingStartedAt: START,
	framesJoinedAt: 0,
	interval: INTERVAL,
	...overrides,
})

describe('isPoseStale', () => {
	it('stays quiet while poses keep arriving', () => {
		expect(isPoseStale(freshness({ now: START + GAP + 1, lastPoseAt: START + GAP }))).toBe(false)
	})

	it('tolerates a gap of one poll period plus the grace period', () => {
		expect(isPoseStale(freshness({ now: START + GAP }))).toBe(false)
	})

	it('reports once the gap outlasts the grace period', () => {
		expect(isPoseStale(freshness({ now: START + GAP + 1 }))).toBe(true)
	})

	it('scales the tolerated gap to the poll period', () => {
		const now = START + 5000 + STALE_AFTER_MS

		expect(isPoseStale(freshness({ now, interval: 5000 }))).toBe(false)
		expect(isPoseStale(freshness({ now, interval: 1000 }))).toBe(true)
	})

	it.each([
		['manual', 0],
		['off', -1],
	])('reports nothing when polling is %s', (_, interval) => {
		expect(isPoseStale(freshness({ now: START + 60_000, interval }))).toBe(false)
	})

	it('gives a part that has never answered a full window to do so', () => {
		expect(isPoseStale(freshness({ now: START + GAP, lastPoseAt: 0 }))).toBe(false)
		expect(isPoseStale(freshness({ now: START + GAP + 1, lastPoseAt: 0 }))).toBe(true)
	})

	it('gives a frame that joined long after polling started a full window', () => {
		const joined = START + 60_000

		expect(isPoseStale(freshness({ now: joined + GAP, framesJoinedAt: joined }))).toBe(false)
	})

	it('reports a frame that joined and then never answered', () => {
		const joined = START + 60_000

		expect(isPoseStale(freshness({ now: joined + GAP + 1, framesJoinedAt: joined }))).toBe(true)
	})

	it('ignores a cached pose predating the switch back to a part', () => {
		const staleCache = freshness({
			now: START + GAP,
			lastPoseAt: START - 60_000,
			pollingStartedAt: START,
		})

		expect(isPoseStale(staleCache)).toBe(false)
	})
})
