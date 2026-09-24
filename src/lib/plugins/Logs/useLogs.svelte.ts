import { untrack } from 'svelte'
import { MathUtils } from 'three'

type Level = 'info' | 'warn' | 'error'

/** The levels worth marking a tree row with. Info there is noise. */
export type LogStatus = 'warn' | 'error'

/**
 * The world tree rows a line is about. Both may be set: a per-camera point cloud
 * failure is about that camera and about the folder whose poll produced it, and
 * naming both marks two rows from one line rather than logging it twice.
 */
export interface LogTarget {
	/** A resource, matched against its `traits.Name`. */
	resource?: string
	/** A folder, matched against its `TreeFolderId`. */
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
}

interface Context {
	current: Log[]
	errorCount: number
	warnCount: number
	add(message: string, level?: Level, target?: LogTarget): void
	/**
	 * Drops every line and the row alerts they raised. Lines are about one machine,
	 * so switching parts has to evict them rather than report the old part's
	 * failures against the new part's resources.
	 */
	clear(): void
	/** Worst level currently logged against a row, or `undefined` when it is clean. */
	statusFor(target: LogTarget): LogStatus | undefined
	/** That row's lines, newest first. */
	linesFor(target: LogTarget): Log[]
}

const MAX_LOGS = 200

// Logs is a singleton. We only have one logger per app and we need to access it anywhere.
// Reactive so a consumer that read through the facade before `<Logs />` mounted
// recomputes against the real sink once it does.
let context = $state<Context | undefined>()

export const provideLogs = () => {
	// A Map keyed by `dedupKey` holds the logs and a `$state` version counter drives reactivity, so an add costs no array allocation.
	const entries = new Map<string, Log>()
	let version = $state(0)

	/**
	 * Warn and error tallies per tally key, maintained as lines arrive and age out.
	 * Every tree row reads `statusFor`, so this is deliberately kept off `entries`:
	 * a scan of the whole log per row per add would be the tree's frame budget.
	 */
	const tallies = new Map<string, { warn: number; error: number }>()
	let statusVersion = $state(0)

	const intl = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'short',
		timeStyle: 'short',
	})

	/**
	 * No timestamp: a line repeating across two clock minutes is the same line, and
	 * keying on the time is what fragmented the list into near-identical rows.
	 */
	const dedupKey = (level: Level, target: LogTarget, message: string): string =>
		`${level}\0${target.resource ?? ''}\0${target.folder ?? ''}\0${message}`

	/** Namespaced so a resource cannot inherit the alerts of a folder sharing its name. */
	const tallyKeys = (target: LogTarget): string[] => {
		const keys: string[] = []
		if (target.resource !== undefined) keys.push(`resource\0${target.resource}`)
		if (target.folder !== undefined) keys.push(`folder\0${target.folder}`)
		return keys
	}

	const worst = (tally: { warn: number; error: number }): LogStatus | undefined =>
		tally.error > 0 ? 'error' : tally.warn > 0 ? 'warn' : undefined

	/** Move a line into or out of every row it names. `delta` is `1` on add, `-1` on evict. */
	const tally = (log: Log, delta: number): void => {
		if (log.level === 'info') return

		for (const key of tallyKeys(log)) {
			const current = tallies.get(key) ?? { warn: 0, error: 0 }
			const before = worst(current)
			current[log.level] += delta

			if (worst(current) === undefined) tallies.delete(key)
			else tallies.set(key, current)

			// Every tree row subscribes to this, so only a change in what a row would
			// draw wakes them, not the repeat of a message already being reported.
			if (before !== worst(current)) statusVersion++
		}
	}

	const evictOldest = (): void => {
		const oldestKey = entries.keys().next().value
		if (oldestKey === undefined) return

		const oldest = entries.get(oldestKey)
		entries.delete(oldestKey)
		if (oldest) tally(oldest, -1)
	}

	/**
	 * Newest first. Each read hands back fresh objects: the entries themselves are
	 * plain (mutating one in place would not notify), so a new identity per version
	 * is what makes a climbing `count` render.
	 */
	const all = $derived.by(() => {
		void version
		const out: Log[] = []
		for (const log of entries.values()) out.push({ ...log })
		out.reverse()
		return out
	})

	const errorCount = $derived.by(() => {
		void version
		let total = 0
		for (const log of entries.values()) if (log.level === 'error') total += 1
		return total
	})

	const warnCount = $derived.by(() => {
		void version
		let total = 0
		for (const log of entries.values()) if (log.level === 'warn') total += 1
		return total
	})

	context = {
		get current() {
			return all
		},
		get errorCount() {
			return errorCount
		},
		get warnCount() {
			return warnCount
		},
		clear() {
			untrack(() => {
				// Tallies are derived from `entries`, so an empty log has no alerts left
				// to retract and waking every tree row here would buy nothing.
				if (entries.size === 0) return

				entries.clear()
				tallies.clear()
				version++
				statusVersion++
			})
		},
		statusFor(target) {
			void statusVersion

			let found: LogStatus | undefined
			for (const key of tallyKeys(target)) {
				const tallied = tallies.get(key)
				if (tallied?.error) return 'error'
				if (tallied?.warn) found = 'warn'
			}
			return found
		},
		linesFor(target) {
			void version
			const out: Log[] = []
			for (const log of entries.values()) {
				const matches =
					(target.resource !== undefined && log.resource === target.resource) ||
					(target.folder !== undefined && log.folder === target.folder)
				if (matches) out.push({ ...log })
			}
			out.reverse()
			return out
		},
		add(message, level = 'info', target = {}) {
			untrack(() => {
				const timestamp = intl.format(Date.now())
				const key = dedupKey(level, target, message)
				const match = entries.get(key)

				if (match) {
					match.count += 1
					match.timestamp = timestamp
					// Re-insert so a line that is still repeating sorts as the newest and
					// is the last to be evicted, rather than ageing out under its own repeats.
					entries.delete(key)
					entries.set(key, match)
				} else {
					const log: Log = {
						uuid: MathUtils.generateUUID(),
						message,
						count: 1,
						level,
						resource: target.resource,
						folder: target.folder,
						timestamp,
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
	add(message, level, target) {
		context?.add(message, level, target)
	},
	clear() {
		context?.clear()
	},
	statusFor(target) {
		return context?.statusFor(target)
	},
	linesFor(target) {
		return context?.linesFor(target) ?? []
	},
}

export const useLogs = (): Context => facade
