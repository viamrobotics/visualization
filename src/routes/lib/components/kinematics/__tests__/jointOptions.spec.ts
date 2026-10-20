import { describe, expect, it } from 'vitest'

import { Joint, Mimic } from '$lib/buf/kinematics/v1/spec_pb'

import { attachOptions, mimicOptions, parentOptions } from '../jointOptions'

const joints = [
	new Joint({ id: 'a', parent: '' }),
	new Joint({ id: 'b', parent: 'a' }),
	new Joint({ id: 'c', parent: 'b' }),
	new Joint({ id: 'd', parent: '', mimic: new Mimic({ joint: 'a' }) }),
]

describe('parentOptions', () => {
	it('excludes the joint itself and every descendant', () => {
		expect(parentOptions(joints, 'a')).toEqual(['d'])
		expect(parentOptions(joints, 'b')).toEqual(['a', 'd'])
	})

	it('offers every other joint to a leaf', () => {
		expect(parentOptions(joints, 'c')).toEqual(['a', 'b', 'd'])
	})
})

describe('mimicOptions', () => {
	it('excludes mimics and the joint itself', () => {
		expect(mimicOptions(joints, 'a')).toEqual(['b', 'c'])
		expect(mimicOptions(joints, 'd')).toEqual(['a', 'b', 'c'])
	})
})

describe('attachOptions', () => {
	it('lists every joint', () => {
		expect(attachOptions(joints)).toEqual(['a', 'b', 'c', 'd'])
	})
})
