import { describe, expect, it } from 'vitest'

import { migrateStoredSettings, SETTINGS_MIGRATION_COUNT } from '../settingsMigrations'

describe('migrateStoredSettings', () => {
	it('converts a move snap step saved in metres to millimetres', () => {
		const migrated = migrateStoredSettings({ migrationsApplied: 1, snapTranslate: 0.1 })

		expect(migrated.snapTranslate).toBeCloseTo(100)
	})

	it('leaves a move snap step alone once the record has seen the conversion', () => {
		const migrated = migrateStoredSettings({
			migrationsApplied: SETTINGS_MIGRATION_COUNT,
			snapTranslate: 100,
		})

		expect(migrated.snapTranslate).toBe(100)
	})

	it('drops the bookkeeping field from what it returns', () => {
		const migrated = migrateStoredSettings({ migrationsApplied: SETTINGS_MIGRATION_COUNT })

		expect(migrated).not.toHaveProperty('migrationsApplied')
	})
})
