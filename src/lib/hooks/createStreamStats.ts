import {
	type FlushRecord,
	STREAM_STATS_WINDOW_MS,
	type StreamStats,
	type StreamStatsSnapshot,
} from './worldStateStreamStats'

interface IngestSample {
	time: number
	count: number
	bytes: number
}

interface FlushSample {
	start: number
	end: number
}

const WINDOW_SECONDS = STREAM_STATS_WINDOW_MS / 1000

/**
 * Rolling-window accumulator behind `StreamStats`. Pure module: no Svelte, no DOM, so it can
 * run in a worker or a plain unit test with an injected clock.
 */
export const createStreamStats = (now: () => number = () => performance.now()): StreamStats => {
	const ingests: IngestSample[] = []
	const flushes: FlushSample[] = []
	let latestFlush: FlushRecord | undefined

	const dropExpiredIngests = (currentTime: number) => {
		const cutoff = currentTime - STREAM_STATS_WINDOW_MS
		while (ingests.length > 0 && ingests[0].time <= cutoff) ingests.shift()
	}

	const dropExpiredFlushes = (currentTime: number) => {
		const cutoff = currentTime - STREAM_STATS_WINDOW_MS
		while (flushes.length > 0 && flushes[0].end <= cutoff) flushes.shift()
	}

	return {
		recordIngest(count, bytes) {
			const currentTime = now()
			dropExpiredIngests(currentTime)
			ingests.push({ time: currentTime, count, bytes: bytes ?? 0 })
		},

		recordFlush(flush) {
			const currentTime = now()
			dropExpiredFlushes(currentTime)
			flushes.push({ start: flush.start, end: flush.end })
			latestFlush = flush
		},

		snapshot(currentTime): StreamStatsSnapshot {
			dropExpiredIngests(currentTime)
			dropExpiredFlushes(currentTime)

			let eventCount = 0
			let byteCount = 0
			for (const sample of ingests) {
				eventCount += sample.count
				byteCount += sample.bytes
			}

			let flushMsMax = 0
			for (const flush of flushes) {
				flushMsMax = Math.max(flushMsMax, flush.end - flush.start)
			}

			return {
				eventsPerSecond: eventCount / WINDOW_SECONDS,
				bytesPerSecond: byteCount / WINDOW_SECONDS,
				appliedLastFlush: latestFlush?.applied ?? 0,
				flushMsLast: latestFlush ? latestFlush.end - latestFlush.start : 0,
				flushMsMax,
				flushesPerSecond: flushes.length / WINDOW_SECONDS,
				backlog: latestFlush?.backlog ?? 0,
				lastFlushStart: latestFlush?.start ?? Number.NaN,
				lastFlushEnd: latestFlush?.end ?? Number.NaN,
			}
		},
	}
}
