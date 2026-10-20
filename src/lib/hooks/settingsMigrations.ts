import type { Settings } from './useSettings.svelte'

/**
 * A settings record as it comes back out of storage, written by whichever version of
 * the app the user last ran. Its shape is whatever `Settings` was then, so a migration
 * reads it as unknown keys rather than trusting today's type.
 */
export type StoredSettings = Record<string, unknown>

/**
 * Appended to, never reordered, never removed. A record carries the count of migrations
 * already applied to it, so an entry's index here is the version it upgrades from, and
 * dropping one would silently re-run every migration that follows it.
 */
const migrations: ((stored: StoredSettings) => void)[] = [
	// Realistic shading became the default, and it is meant to be what everyone sees, not
	// only the users with no saved settings. Overrides a deliberate choice of another
	// mode, which the settings panel can set back.
	(stored) => {
		stored.renderMode = 'realistic'
	},
]

/** Stamped onto every record written, so the next load can tell what it has already seen. */
export const SETTINGS_MIGRATION_COUNT = migrations.length

/**
 * Brings a stored record up to date and drops the bookkeeping field, so what comes back
 * merges over the defaults as settings and nothing else.
 *
 * A record written before migrations existed carries no count and is treated as having
 * seen none, which is what puts the users who predate a migration through it.
 */
export const migrateStoredSettings = (stored: StoredSettings): Partial<Settings> => {
	const { migrationsApplied, ...settings } = stored
	const applied = typeof migrationsApplied === 'number' ? migrationsApplied : 0

	for (const migration of migrations.slice(applied)) {
		migration(settings)
	}

	return settings as Partial<Settings>
}
