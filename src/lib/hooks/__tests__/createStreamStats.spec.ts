import { describe, expect, it } from 'vitest'

import { createStreamStats } from '../createStreamStats'
import { STREAM_STATS_WINDOW_MS } from '../worldStateStreamStats'

describe('createStreamStats', () => {
	it('reports zero rates and NaN flush timestamps before anything is recorded', () => {
		const t = 0
		const stats = createStreamStats(() => t)

		const snapshot = stats.snapshot(t)

		expect(snapshot.eventsPerSecond).toBe(0)
		expect(snapshot.bytesPerSecond).toBe(0)
		expect(snapshot.flushesPerSecond).toBe(0)
		expect(snapshot.flushMsMax).toBe(0)
		expect(snapshot.appliedLastFlush).toBe(0)
		expect(snapshot.flushMsLast).toBe(0)
		expect(snapshot.backlog).toBe(0)
		expect(snapshot.lastFlushStart).toBeNaN()
		expect(snapshot.lastFlushEnd).toBeNaN()
	})

	it('counts ingested events and bytes within the window', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordIngest(10, 100)
		t = 200
		stats.recordIngest(5, 50)

		const snapshot = stats.snapshot(t)

		expect(snapshot.eventsPerSecond).toBe(15 / (STREAM_STATS_WINDOW_MS / 1000))
		expect(snapshot.bytesPerSecond).toBe(150 / (STREAM_STATS_WINDOW_MS / 1000))
	})

	it('treats undefined bytes as 0, so bytesPerSecond reads 0 while byte counts are unknown', () => {
		const t = 0
		const stats = createStreamStats(() => t)

		stats.recordIngest(10)

		expect(stats.snapshot(t).bytesPerSecond).toBe(0)
	})

	it('drops an ingest sample exactly at the window boundary', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordIngest(10, 100)
		t = STREAM_STATS_WINDOW_MS

		expect(stats.snapshot(t).eventsPerSecond).toBe(0)
	})

	it('keeps an ingest sample one millisecond inside the window boundary', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordIngest(10, 100)
		t = STREAM_STATS_WINDOW_MS - 1

		expect(stats.snapshot(t).eventsPerSecond).toBe(10 / (STREAM_STATS_WINDOW_MS / 1000))
	})

	it('counts flushes per second within the window', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordFlush({ start: 0, end: 10, applied: 3, backlog: 0 })
		t = 500
		stats.recordFlush({ start: 500, end: 520, applied: 4, backlog: 0 })

		expect(stats.snapshot(t).flushesPerSecond).toBe(2 / (STREAM_STATS_WINDOW_MS / 1000))
	})

	it('reports flushMsMax as the longest flush still in the window, and flushMsLast as the most recent regardless of window', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordFlush({ start: 0, end: 100, applied: 1, backlog: 0 })
		t = 900
		stats.recordFlush({ start: 900, end: 910, applied: 2, backlog: 0 })

		const withinWindow = stats.snapshot(t)
		expect(withinWindow.flushMsMax).toBe(100)
		expect(withinWindow.flushMsLast).toBe(10)

		t = STREAM_STATS_WINDOW_MS + 100
		const afterExpiry = stats.snapshot(t)
		expect(afterExpiry.flushMsMax).toBe(10)
		expect(afterExpiry.flushMsLast).toBe(10)
	})

	it('reports appliedLastFlush and backlog from the newest flush ever recorded, unbound by the window', () => {
		let t = 0
		const stats = createStreamStats(() => t)

		stats.recordFlush({ start: 0, end: 5, applied: 7, backlog: 2 })
		t = STREAM_STATS_WINDOW_MS + 500
		const snapshot = stats.snapshot(t)

		expect(snapshot.appliedLastFlush).toBe(7)
		expect(snapshot.backlog).toBe(2)
		expect(snapshot.lastFlushStart).toBe(0)
		expect(snapshot.lastFlushEnd).toBe(5)
	})
})
