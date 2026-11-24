import { describe, expect, it } from 'vitest'

import { MIXED, sharedNumber } from '../sharedValue'

describe('sharedNumber', () => {
	it('reads numbers apart only by matrix decomposition noise as one value', () => {
		expect(sharedNumber([100, 100.000_000_001])).toBe(100)
	})

	it('reports numbers that differ as mixed', () => {
		expect(sharedNumber([100, 200])).toBe(MIXED)
	})
})
