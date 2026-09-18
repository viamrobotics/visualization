import { describe, expect, it } from 'vitest'

import { isPoseStale, type PoseFreshness, STALE_AFTER_MS } from '../isPoseStale'

const START = 1_000_000
const INTERVAL = 1000
const GAP = INTERVAL + STALE_AFTER_MS

/** Joined when polling started, which is what `usePoses` gives a frame at mount. */
const frame = (dataUpdatedAt: number, joinedAt = START) => ({ query: { dataUpdatedAt }, joinedAt })

const freshness = (overrides: Partial<PoseFreshness> = {}): PoseFreshness => ({
	now: START,
	pollingStartedAt: START,
	interval: INTERVAL,
	frames: [frame(START)],
	...overrides,
})

describe('isPoseStale', () => {
	it('stays quiet while poses keep arriving', () => {
		const answering = freshness({ now: START + GAP + 1, frames: [frame(START + GAP)] })

		expect(isPoseStale(answering)).toBe(false)
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

	it('reports nothing for a scene with no polled frames', () => {
		expect(isPoseStale(freshness({ now: START + 60_000, frames: [] }))).toBe(false)
	})

	it('gives a part that has never answered a full window to do so', () => {
		expect(isPoseStale(freshness({ now: START + GAP, frames: [frame(0)] }))).toBe(false)
		expect(isPoseStale(freshness({ now: START + GAP + 1, frames: [frame(0)] }))).toBe(true)
	})

	it('gives a frame that joined long after polling started a full window', () => {
		const joined = START + 60_000
		const joining = freshness({ now: joined + GAP, frames: [frame(0, joined)] })

		expect(isPoseStale(joining)).toBe(false)
	})

	it('reports a frame that joined and then never answered', () => {
		const joined = START + 60_000
		const silent = freshness({ now: joined + GAP + 1, frames: [frame(0, joined)] })

		expect(isPoseStale(silent)).toBe(true)
	})

	it('goes on reporting the frame that stopped answering while another frame joins', () => {
		const now = START + 60_000
		const stalledBeside = freshness({ now, frames: [frame(START), frame(0, now)] })

		expect(isPoseStale(stalledBeside)).toBe(true)
	})

	it('blames no frame while every one of them is still inside its first window', () => {
		const now = START + 60_000
		const allJoining = freshness({ now, frames: [frame(0, now), frame(0, now - 1)] })

		expect(isPoseStale(allJoining)).toBe(false)
	})

	it('stays quiet while one settled frame is answering and another is not', () => {
		const now = START + 60_000
		const oneAnswering = freshness({ now, frames: [frame(START), frame(now - 1)] })

		expect(isPoseStale(oneAnswering)).toBe(false)
	})

	it('ignores a cached pose predating the switch back to a part', () => {
		const staleCache = freshness({
			now: START + GAP,
			pollingStartedAt: START,
			frames: [frame(START - 60_000)],
		})

		expect(isPoseStale(staleCache)).toBe(false)
	})
})
