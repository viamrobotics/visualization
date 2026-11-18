import { describe, expect, it } from 'vitest'

import type { JointFrameDescriptor } from '$lib/motion/frameDescriptors'

import { armInputsFromJointPositions } from '../armInputsFromJointPositions'

const joint = (
	overrides: Partial<JointFrameDescriptor> &
		Pick<JointFrameDescriptor, 'motion' | 'jointIndex' | 'name'>
): JointFrameDescriptor => ({
	kind: 'joint',
	parent: 'arm:base',
	axis: { X: 0, Y: 0, Z: 1 },
	componentName: 'arm',
	uuid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
	...overrides,
})

describe('armInputsFromJointPositions', () => {
	it('converts rotational joints from degrees to radians and leaves translational ones in mm', () => {
		const descriptors = [
			joint({ name: 'arm:j0', jointIndex: 0, motion: 'rotational' }),
			joint({ name: 'arm:j1', jointIndex: 1, motion: 'translational' }),
		]

		expect(armInputsFromJointPositions(descriptors, 'arm', [90, 250])).toEqual([
			expect.closeTo(Math.PI / 2, 10),
			250,
		])
	})

	it('reads a column from the joint that owns it, not from a mimic of it', () => {
		const descriptors = [
			joint({ name: 'arm:j0', jointIndex: 0, motion: 'translational' }),
			joint({
				name: 'arm:j0-mimic',
				jointIndex: 0,
				motion: 'rotational',
				mimic: { multiplier: 1, offset: 0 },
			}),
		]

		expect(armInputsFromJointPositions(descriptors, 'arm', [12])).toEqual([12])
	})

	it('refuses positions the arm kinematics have no joint for', () => {
		const descriptors = [
			joint({ name: 'arm:j0', jointIndex: 0, motion: 'rotational' }),
			joint({ name: 'other:j1', jointIndex: 1, motion: 'rotational', componentName: 'other' }),
		]

		expect(armInputsFromJointPositions(descriptors, 'arm', [10, 20])).toBeUndefined()
	})
})
