import { describe, expect, it } from 'vitest'

import { migrateStoredSettings, SETTINGS_MIGRATION_COUNT } from '../settingsMigrations'

describe('migrateStoredSettings', () => {
	it('drops the bookkeeping field from what it returns', () => {
		const migrated = migrateStoredSettings({ migrationsApplied: SETTINGS_MIGRATION_COUNT })

		expect(migrated).not.toHaveProperty('migrationsApplied')
	})
})
