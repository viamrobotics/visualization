import { describe, expect, it } from 'vitest'
import * as Subject from '../json'

describe('json', () => {
	describe('isJSONExtension', () => {
		it.each(['json', 'JSON', 'Json'])('returns true for %s', (value) => {
			expect(Subject.isJSONExtension(value)).toBe(true)
		})

		it.each(['jason', 'json.gz', ''])('returns false for %s', (value) => {
			expect(Subject.isJSONExtension(value)).toBe(false)
		})
	})

	describe('isJSONPrefix', () => {
		it.each(['snapshot', 'SNAPSHOT', 'Snapshot'])('returns true for %s', (value) => {
			expect(Subject.isJSONPrefix(value)).toBe(true)
		})

		it.each(['snapshots', ''])('returns false for %s', (value) => {
			expect(Subject.isJSONPrefix(value)).toBe(false)
		})
	})
})
