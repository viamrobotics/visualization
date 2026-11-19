import { getContext, setContext } from 'svelte'

/**
 * Trailing-window statistics for one world-state transform stream.
 *
 * Rates are computed over the last `STREAM_STATS_WINDOW_MS`. Times are
 * `performance.now()` milliseconds. `flushMs*` measure the `applyEvents` callback
 * body only; the Svelte and koota work it queues runs after the callback returns,
 * so the pane pairs `lastFlushStart` with a long-animation-frame entry to show the
 * whole frame.
 */
export interface StreamStatsSnapshot {
	/** Stream events ingested per second over the window. */
	eventsPerSecond: number
	/** Payload bytes per second over the window; 0 while byte counts are unknown. */
	bytesPerSecond: number
	/** Events applied by the most recent flush. */
	appliedLastFlush: number
	/** Duration of the most recent flush callback, ms. */
	flushMsLast: number
	/** Longest flush callback in the window, ms. */
	flushMsMax: number
	/** Flushes per second over the window. */
	flushesPerSecond: number
	/** Events still pending when the most recent flush returned. */
	backlog: number
	/** Start of the most recent flush, or NaN before the first flush. */
	lastFlushStart: number
	/** End of the most recent flush, or NaN before the first flush. */
	lastFlushEnd: number
}

export interface FlushRecord {
	start: number
	end: number
	applied: number
	backlog: number
}

export interface StreamStats {
	recordIngest(count: number, bytes?: number): void
	recordFlush(flush: FlushRecord): void
	snapshot(now: number): StreamStatsSnapshot
}

/** Trailing window every rate and maximum is computed over. */
export const STREAM_STATS_WINDOW_MS = 1000

/**
 * One `StreamStats` per world-state store, keyed by resource name. A plain map,
 * not Svelte state: the stats pane polls it on its own publish interval.
 */
export interface WorldStateStreamStatsRegistry {
	/** Register a store's stats; returns the unregister function. */
	register(name: string, stats: StreamStats): () => void
	entries(): ReadonlyMap<string, StreamStats>
}

const CONTEXT_KEY = Symbol('world-state-stream-stats')

/** Call once during `provideWorldStates` component init. */
export const provideWorldStateStreamStats = (): WorldStateStreamStatsRegistry => {
	const stores = new Map<string, StreamStats>()
	const registry: WorldStateStreamStatsRegistry = {
		register(name, stats) {
			stores.set(name, stats)
			return () => {
				if (stores.get(name) === stats) stores.delete(name)
			}
		},
		entries: () => stores,
	}
	return setContext(CONTEXT_KEY, registry)
}

/** `undefined` outside a `provideWorldStates` subtree, e.g. a scene without stores. */
export const useWorldStateStreamStats = (): WorldStateStreamStatsRegistry | undefined =>
	getContext<WorldStateStreamStatsRegistry | undefined>(CONTEXT_KEY)
