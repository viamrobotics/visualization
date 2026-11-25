import { get, set } from 'idb-keyval'

/** Set once the migration has run for a storage key, so it never runs again. */
const MIGRATED_MARKER = 'storage-migrated'

/** The IndexedDB key the settings lived under before `storageKey`. */
const LEGACY_SETTINGS_KEY = 'motion-tools-settings'

/** Legacy `localStorage` keys, each with the base key it now lives under. */
const RENAMED_KEYS: Record<string, string> = {
	'motion-tools:environment-mode': 'environment-mode',
	'motion-tools:control-widgets': 'control-widgets',
	'motion-tools:control-widget-rects': 'control-widget-rects',
	'details-active-tab': 'details-active-tab',
	'orientation-format': 'orientation-format',
	'settings-active-tab': 'settings-active-tab',
	'world-tree-expanded-folders': 'world-tree-expanded-folders',
}

/** Legacy prefixes of per-part and per-frame keys, each with the prefix it now carries. */
const RENAMED_PREFIXES: Record<string, string> = {
	'motion-tools:move-world-state:': 'move-world-state:',
	'motion-tools:move-constraints:': 'move-constraints:',
	'motion-tools:move-tab:': 'move-tab:',
}

/** The suffix of the per-resource expanded keys, which kept their names. */
const WIDGETS_EXPANDED_SUFFIX = ':widgets-expanded'

/**
 * The key `legacyKey` moves to under `storageKey`, or `undefined` when it is not a legacy key.
 * A key already under `storageKey` is never legacy.
 */
export const migratedKeyFor = (legacyKey: string, storageKey: string): string | undefined => {
	if (legacyKey.startsWith(`${storageKey}:`)) return undefined

	const renamed = RENAMED_KEYS[legacyKey]
	if (renamed !== undefined) return `${storageKey}:${renamed}`

	for (const [legacyPrefix, prefix] of Object.entries(RENAMED_PREFIXES)) {
		if (legacyKey.startsWith(legacyPrefix)) {
			return `${storageKey}:${prefix}${legacyKey.slice(legacyPrefix.length)}`
		}
	}

	if (legacyKey.endsWith(WIDGETS_EXPANDED_SUFFIX)) return `${storageKey}:${legacyKey}`

	return undefined
}

// TODO(2027-02-25): remove this migration and its call in +layout.ts.
/**
 * Copies the state the visualizer kept before `storageKey` existed into `storageKey`, once. A
 * value already under `storageKey` is never overwritten, and the legacy keys are left in place.
 */
export const migrateLegacyStorage = async (storageKey: string): Promise<void> => {
	const markerKey = `${storageKey}:${MIGRATED_MARKER}`
	if (localStorage.getItem(markerKey) !== null) return

	const legacyKeys = Array.from({ length: localStorage.length }, (_, index) =>
		localStorage.key(index)
	).filter((key) => key !== null)

	for (const legacyKey of legacyKeys) {
		const target = migratedKeyFor(legacyKey, storageKey)
		const value = localStorage.getItem(legacyKey)
		if (target === undefined || value === null || localStorage.getItem(target) !== null) continue

		localStorage.setItem(target, value)
	}

	const settingsTarget = `${storageKey}:settings`
	const legacySettings: unknown = await get(LEGACY_SETTINGS_KEY)
	if (legacySettings !== undefined && (await get(settingsTarget)) === undefined) {
		await set(settingsTarget, legacySettings)
	}

	localStorage.setItem(markerKey, 'true')
}
