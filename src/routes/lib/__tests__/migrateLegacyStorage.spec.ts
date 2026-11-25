import { get, set } from 'idb-keyval'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { migratedKeyFor, migrateLegacyStorage } from '../migrateLegacyStorage'

const database = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
	get: vi.fn((key: string) => Promise.resolve(database.get(key))),
	set: vi.fn((key: string, value: unknown) => {
		database.set(key, value)
		return Promise.resolve()
	}),
}))

beforeEach(() => {
	localStorage.clear()
	database.clear()
	vi.mocked(get).mockImplementation((key) => Promise.resolve(database.get(String(key))))
	vi.mocked(set).mockImplementation((key, value) => {
		database.set(String(key), value)
		return Promise.resolve()
	})
})

describe('migratedKeyFor', () => {
	it.each([
		{ legacyKey: 'motion-tools:environment-mode', expected: 'visualizer:environment-mode' },
		{ legacyKey: 'orientation-format', expected: 'visualizer:orientation-format' },
		{
			legacyKey: 'motion-tools:move-world-state:part-1:arm',
			expected: 'visualizer:move-world-state:part-1:arm',
		},
		{
			legacyKey: 'part-1:remote:arm:widgets-expanded',
			expected: 'visualizer:part-1:remote:arm:widgets-expanded',
		},
		{ legacyKey: 'visualizer:environment-mode', expected: undefined },
		{ legacyKey: 'unrelated-app-key', expected: undefined },
	])('moves $legacyKey to $expected', ({ legacyKey, expected }) => {
		expect(migratedKeyFor(legacyKey, 'visualizer')).toBe(expected)
	})
})

describe('migrateLegacyStorage', () => {
	it('copies a legacy value to its key under the storage key', async () => {
		localStorage.setItem('motion-tools:environment-mode', JSON.stringify('build'))

		await migrateLegacyStorage('visualizer')

		expect(localStorage.getItem('visualizer:environment-mode')).toBe(JSON.stringify('build'))
	})

	it('never overwrites a value already under the storage key', async () => {
		localStorage.setItem('motion-tools:environment-mode', JSON.stringify('build'))
		localStorage.setItem('visualizer:environment-mode', JSON.stringify('move'))

		await migrateLegacyStorage('visualizer')

		expect(localStorage.getItem('visualizer:environment-mode')).toBe(JSON.stringify('move'))
	})

	it('copies the settings in IndexedDB', async () => {
		database.set('motion-tools-settings', { gridSize: 2 })

		await migrateLegacyStorage('visualizer')

		expect(database.get('visualizer:settings')).toEqual({ gridSize: 2 })
	})

	it('runs only once per storage key', async () => {
		await migrateLegacyStorage('visualizer')
		localStorage.setItem('motion-tools:environment-mode', JSON.stringify('build'))

		await migrateLegacyStorage('visualizer')

		expect(localStorage.getItem('visualizer:environment-mode')).toBe(null)
	})
})
