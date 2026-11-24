import { describe, expect, it } from 'vitest'

import { nextCopyName } from '#lib/obstacleCopyName.js'

describe('nextCopyName', () => {
	it('names the first copy <name>-copy', () => {
		expect(nextCopyName([], 'table')).toBe('table-copy')
	})

	it('numbers from 2 once -copy is taken', () => {
		expect(nextCopyName(['table-copy'], 'table')).toBe('table-copy-2')
	})

	it('skips every taken number', () => {
		expect(nextCopyName(['table-copy', 'table-copy-2', 'table-copy-3'], 'table')).toBe(
			'table-copy-4'
		)
	})

	it('gives a copy of a copy its source base, not -copy-copy', () => {
		expect(nextCopyName(['table-copy'], 'table-copy')).toBe('table-copy-2')
	})

	it('gives a copy of a numbered copy the next free number', () => {
		expect(nextCopyName(['table-copy', 'table-copy-2'], 'table-copy-2')).toBe('table-copy-3')
	})

	it('keeps a trailing number that is not a copy suffix', () => {
		expect(nextCopyName([], 'obstacle-3')).toBe('obstacle-3-copy')
	})
})
