import { describe, expect, it } from 'vitest'

import { Joint, KinematicsSpec, Link } from '$lib/buf/kinematics/v1/spec_pb'

import { kinematicsItem } from '../kinematicsItem'

const link = new Link({ id: 'arm' })
const joint = new Joint({ id: 'hinge' })
const spec = new KinematicsSpec({ name: 'arm', links: [link], joints: [joint] })

describe('kinematicsItem', () => {
	it.each([
		{ name: 'root', expected: { kind: 'root' } },
		{ name: 'arm', expected: { kind: 'link', link } },
		{ name: 'hinge', expected: { kind: 'joint', joint } },
		{ name: 'tcp', expected: { kind: 'tcp' } },
		{ name: 'arm visual', expected: { kind: 'visual', link } },
		{ name: 'arm previous', expected: undefined },
		{ name: 'ghost visual', expected: undefined },
		{ name: 'unknown', expected: undefined },
	])('maps $name', ({ name, expected }) => {
		expect(kinematicsItem(spec, name)).toEqual(expected)
	})
})
