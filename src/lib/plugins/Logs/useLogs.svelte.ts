import { untrack } from 'svelte'
import { MathUtils } from 'three'

type Level = 'info' | 'warn' | 'error'

/**
 * The world tree rows a line is about. Both may be set: a per-camera point cloud
 * failure is about that camera and about the folder whose poll produced it, and
 * naming both marks two rows from one line rather than logging it twice.
 */
export interface LogTarget {
	/** A resource, matched against its `traits.Name`. */
	resource?: string
	/** A folder, matched against its `traits.Folder` id. */
	folder?: string
}

export interface Log extends LogTarget {
	uuid: string
	message: string
	/** Occurrences of this exact line. Repeats collapse rather than stacking up. */
	count: number
	level: Level
	/** Most recent occurrence, so a collapsed line still reads as current. */
	timestamp: string
	/**
	 * The producer that filed the line, which is what `retractSource` matches. Two producers
	 * reporting the same message about the same rows keep separate lines.
	 */
	source?: string
}

interface Context {
	current: Log[]
	errorCount: number
	warnCount: number
	add(message: string, level?: Level, target?: LogTarget, source?: string): void
	/**
	 * Drops one line, matched the same way `add` collapses repeats. For a warning
	 * that describes a state rather than an event: once the condition stops
	 * holding, a line nothing can withdraw goes on reporting a failure that has
	 * already been fixed.
	 *
	 * Silent when no line matches, so a caller can retract unconditionally.
	 */
	retract(message: string, level: Level, target?: LogTarget, source?: string): void
	/**
	 * Drops every line `source` filed, whatever its message, level, or rows. For a producer that
	 * stops, such as a camera the user switched off, whose old failures would go on marking its rows.
	 * Another producer's lines about the same rows are left alone.
	 */
	retractSource(source: string): void
	/** Drops every line and the row alerts they raised, for the panel's clear button. */
	clear(): void
}

/** Position of a line's first occurrence, which is what the list sorts by. */
interface Entry extends Log {
	sequence: number
}

const MAX_LOGS = 200

// Logs is a singleton. We only have one logger per app and we need to access it anywhere.
// Reactive so a consumer that read through the facade before `<Logs />` mounted
// recomputes against the real sink once it does.
let context = $state<Context | undefined>()

export const provideLogs = () => {
	// A Map keyed by `dedupKey` holds the logs and a `$state` version counter drives reactivity, so an add costs no array allocation.
	// Map order is recency, for eviction only. See `Entry` for display order.
	const entries = new Map<string, Entry>()
	let version = $state(0)
	let nextSequence = 0

	/**
	 * Distinct warn and error lines, for the trigger badge. Kept as running totals
	 * so a repeat, which is most adds at a live pose rate, costs the badge nothing.
	 */
	const lineCounts = $state({ warn: 0, error: 0 })

	const intl = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'short',
		timeStyle: 'short',
	})

	/**
	 * No timestamp: a line repeating across two clock minutes is the same line, and
	 * keying on the time is what fragmented the list into near-identical rows.
	 */
	const dedupKey = (level: Level, target: LogTarget, message: string, source = ''): string =>
		`${level}\0${target.resource ?? ''}\0${target.folder ?? ''}\0${source}\0${message}`

	/** Move a line into or out of the badge totals. `delta` is `1` on add, `-1` on evict. */
	const tally = (log: Log, delta: number): void => {
		if (log.level === 'info') return
		lineCounts[log.level] += delta
	}

	const evictOldest = (): void => {
		const oldestKey = entries.keys().next().value
		if (oldestKey === undefined) return

		const oldest = entries.get(oldestKey)
		entries.delete(oldestKey)
		if (oldest) tally(oldest, -1)
	}

	/**
	 * Latest first appearance first. A repeat updates its line in place rather
	 * than lifting it, since lines repeating every pose tick would otherwise
	 * leapfrog each other faster than the list can be read.
	 */
	const byFirstAppearance = (a: Entry, b: Entry): number => b.sequence - a.sequence

	/**
	 * Each read hands back fresh objects: the entries themselves are plain
	 * (mutating one in place would not notify), so a new identity per version is
	 * what makes a climbing `count` render.
	 */
	const all = $derived.by(() => {
		void version
		const out: Entry[] = []
		for (const log of entries.values()) out.push({ ...log })
		return out.toSorted(byFirstAppearance)
	})

	context = {
		get current() {
			return all
		},
		get errorCount() {
			return lineCounts.error
		},
		get warnCount() {
			return lineCounts.warn
		},
		retract(message, level, target = {}, source) {
			untrack(() => {
				const key = dedupKey(level, target, message, source)
				const match = entries.get(key)
				if (!match) return

				entries.delete(key)
				tally(match, -1)
				version++
			})
		},
		retractSource(source) {
			untrack(() => {
				let retracted = false

				for (const [key, log] of entries) {
					if (log.source !== source) continue

					entries.delete(key)
					tally(log, -1)
					retracted = true
				}

				if (retracted) version++
			})
		},
		clear() {
			untrack(() => {
				// An empty log has no alerts left to retract, and waking every reader would buy nothing.
				if (entries.size === 0) return

				entries.clear()
				lineCounts.warn = 0
				lineCounts.error = 0
				version++
			})
		},
		add(message, level = 'info', target = {}, source) {
			untrack(() => {
				const timestamp = intl.format(Date.now())
				const key = dedupKey(level, target, message, source)
				const match = entries.get(key)

				if (match) {
					match.count += 1
					match.timestamp = timestamp
					// Re-insert so a line that is still repeating is the last to be evicted,
					// rather than ageing out under its own repeats.
					entries.delete(key)
					entries.set(key, match)
				} else {
					const log: Entry = {
						sequence: nextSequence++,
						uuid: MathUtils.generateUUID(),
						message,
						count: 1,
						level,
						resource: target.resource,
						folder: target.folder,
						timestamp,
						source,
					}
					entries.set(key, log)
					tally(log, 1)
					if (entries.size > MAX_LOGS) evictOldest()
				}

				version++
			})
		},
	}

	return context
}

/**
 * The logs context, reading as empty while the Logs plugin is not installed.
 *
 * Every accessor resolves the provider on the call rather than at setup, so a
 * consumer that mounts before `<Logs />` still reaches the real sink instead of
 * holding a no-op forever. Plugin order in the layout is then not load-bearing.
 */
const facade: Context = {
	get current() {
		return context?.current ?? []
	},
	get errorCount() {
		return context?.errorCount ?? 0
	},
	get warnCount() {
		return context?.warnCount ?? 0
	},
	add(message, level, target, source) {
		context?.add(message, level, target, source)
	},
	retract(message, level, target, source) {
		context?.retract(message, level, target, source)
	},
	retractSource(source) {
		context?.retractSource(source)
	},
	clear() {
		context?.clear()
	},
}

export const useLogs = (): Context => facade
