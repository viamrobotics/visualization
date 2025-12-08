import { describe, expect, it, vi } from 'vitest'

// Mock the pcd loader to avoid Worker instantiation in test environment
vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(),
}))

import * as Subject from '../mesh'

describe('mesh', () => {
	describe('isMeshExtension', () => {
		it.each(['pcd', 'PCD', 'Pcd'])('returns true for %s', (value) => {
			expect(Subject.isMeshExtension(value)).toBe(true)
		})

		it.each(['ply', 'PLY', 'Ply'])('returns true for %s', (value) => {
			expect(Subject.isMeshExtension(value)).toBe(true)
		})

		it.each(['json', 'txt', ''])('returns false for %s', (value) => {
			expect(Subject.isMeshExtension(value)).toBe(false)
		})
	})
})
