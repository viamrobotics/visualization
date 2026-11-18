import { describe, expect, it } from 'vitest'

import { launchFileFromSecondInstance } from '../secondInstanceData'

describe('launchFileFromSecondInstance', () => {
	it('returns the launch file a second instance resolved', () => {
		expect(launchFileFromSecondInstance({ launchFile: '/tmp/launch.json' })).toBe(
			'/tmp/launch.json'
		)
	})

	it('returns undefined when the second launch had no launch file', () => {
		expect(launchFileFromSecondInstance({})).toBeUndefined()
	})

	it.each([
		['null', null],
		['a string', '/tmp/launch.json'],
		['a non-string launchFile', { launchFile: 5 }],
	])('returns undefined for %s', (_label, data) => {
		expect(launchFileFromSecondInstance(data)).toBeUndefined()
	})
})
