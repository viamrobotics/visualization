import type { ResourceName } from '@viamrobotics/sdk'

import { describe, expect, it } from 'vitest'

import { defaultMotionService, motionServiceNames } from '../moveControls'

const resource = (subtype: string, type = 'service', name = `${subtype}-1`): ResourceName =>
	({ namespace: 'rdk', type, subtype, name }) as ResourceName

describe('motionServiceNames', () => {
	it('keeps only motion services and maps to names, in order', () => {
		expect(
			motionServiceNames([
				resource('vision', 'service', 'vision-1'),
				resource('motion', 'service', 'builtin'),
				resource('motion', 'component', 'not-a-service'),
				resource('motion', 'service', 'planner'),
			])
		).toEqual(['builtin', 'planner'])
	})

	it('is empty when the machine has no motion service', () => {
		expect(motionServiceNames([resource('arm', 'component')])).toEqual([])
	})
})

describe('defaultMotionService', () => {
	it('prefers the built-in service', () => {
		expect(defaultMotionService(['planner', 'builtin'])).toBe('builtin')
	})

	it('falls back to the first when there is no built-in', () => {
		expect(defaultMotionService(['planner', 'secondary'])).toBe('planner')
	})

	it('is empty when there are no services', () => {
		expect(defaultMotionService([])).toBe('')
	})
})
