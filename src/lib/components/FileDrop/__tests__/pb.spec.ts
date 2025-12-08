import { describe, expect, it } from 'vitest'
import * as Subject from '../pb'

describe('pb', () => {
	describe('isPBExtension', () => {
		it.each(['pb', 'PB', 'Pb'])('returns true for %s', (value) => {
			expect(Subject.isPBExtension(value)).toBe(true)
		})

		it.each(['pb.gz', 'PB.GZ', 'Pb.Gz'])('returns true for %s', (value) => {
			expect(Subject.isPBExtension(value)).toBe(true)
		})

		it.each(['json', 'txt', 'gz', ''])('returns false for %s', (value) => {
			expect(Subject.isPBExtension(value)).toBe(false)
		})
	})

	describe('isPBPrefix', () => {
		it.each(['snapshot', 'SNAPSHOT', 'Snapshot'])('returns true for %s', (value) => {
			expect(Subject.isPBPrefix(value)).toBe(true)
		})

		it.each(['snapshots', ''])('returns false for %s', (value) => {
			expect(Subject.isPBPrefix(value)).toBe(false)
		})
	})
})
