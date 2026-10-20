import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/buf/common/v1/common_pb'
import { Joint, KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import { parentWorld0, toAssembly, toLocal } from '../localPose'

const spec = new KinematicsSpec({
	name: 'tool',
	joints: [
		new Joint({
			id: 'hinge',
			origin: new Pose({ x: 100, y: -20, z: 50, oX: 0.3, oY: 0.5, oZ: 0.8, theta: 40 }),
		}),
	],
})

const sample = { x: 10, y: 20, z: 30, oX: 0, oY: 1, oZ: 0, theta: 25 }

const FIELDS = ['x', 'y', 'z', 'oX', 'oY', 'oZ', 'theta'] as const

describe('parentWorld0', () => {
	it('is identity for the model', () => {
		expect(parentWorld0(spec, '')).toEqual({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	it('is the joint origin for a joint', () => {
		const origin = parentWorld0(spec, 'hinge')
		expect([origin.x, origin.y, origin.z, origin.theta]).toEqual([100, -20, 50, 40])
	})

	it('throws for a parent that names no joint', () => {
		expect(() => parentWorld0(spec, 'nope')).toThrow('nope')
	})
})

describe('toLocal and toAssembly', () => {
	it('toLocal under the model is identity', () => {
		expect(toLocal(spec, '', sample)).toEqual(sample)
		expect(toLocal(spec, '', undefined)).toEqual(parentWorld0(spec, ''))
	})

	it('moves a pose into the joint frame', () => {
		const local = toLocal(spec, 'hinge', sample)
		expect(local).not.toEqual(sample)
	})

	it('round-trips through a joint with a rotated origin', () => {
		const roundTrip = toAssembly(spec, 'hinge', toLocal(spec, 'hinge', sample))
		for (const field of FIELDS) expect(roundTrip[field]).toBeCloseTo(sample[field], 9)
	})

	it('maps the joint origin itself to identity', () => {
		const local = toLocal(spec, 'hinge', parentWorld0(spec, 'hinge'))
		expect([local.x, local.y, local.z]).toEqual([0, 0, 0].map((value) => expect.closeTo(value, 9)))
		expect(local.theta).toBeCloseTo(0, 9)
	})

	it('throws for an unknown parent', () => {
		expect(() => toLocal(spec, 'nope', sample)).toThrow('nope')
		expect(() => toAssembly(spec, 'nope', sample)).toThrow('nope')
	})
})
