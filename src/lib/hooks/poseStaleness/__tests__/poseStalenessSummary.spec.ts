import { describe, expect, it } from 'vitest'

import { poseStalenessSummary } from '../poseStalenessSummary'

describe('poseStalenessSummary', () => {
	it('stays generic when the machine blamed nothing', () => {
		expect(poseStalenessSummary([])).toBe('Poses are not updating')
	})

	it('names the resource when exactly one is unhealthy', () => {
		expect(poseStalenessSummary([{ name: 'arm-1', error: 'joint 3 not responding' }])).toBe(
			'Poses are not updating: arm-1 is unhealthy'
		)
	})

	it('counts rather than lists once more than one is unhealthy', () => {
		const unhealthy = [
			{ name: 'arm-1', error: 'joint 3 not responding' },
			{ name: 'gantry-1', error: 'homing failed' },
		]

		expect(poseStalenessSummary(unhealthy)).toBe(
			'Poses are not updating: 2 resources are unhealthy'
		)
	})
})
