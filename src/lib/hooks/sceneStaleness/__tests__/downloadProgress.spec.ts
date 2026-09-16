import { describe, expect, it } from 'vitest'

import { downloadProgress } from '../downloadProgress'

describe('downloadProgress', () => {
	it('reads out both halves in megabytes', () => {
		expect(downloadProgress(14_200_000, 61_000_000)).toBe('14.2 / 61.0 MB')
	})

	it('reports nothing when the machine has not learned the size yet', () => {
		expect(downloadProgress(14_200_000, 0)).toBeUndefined()
	})

	it('reports nothing for a negative total rather than rendering it', () => {
		expect(downloadProgress(0, -1)).toBeUndefined()
	})

	it('keeps a fresh download at zero rather than hiding it', () => {
		expect(downloadProgress(0, 61_000_000)).toBe('0.0 / 61.0 MB')
	})

	it('rounds to a tenth of a megabyte', () => {
		expect(downloadProgress(1_249_999, 2_000_000)).toBe('1.2 / 2.0 MB')
	})
})
