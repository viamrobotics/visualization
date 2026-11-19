import { MathUtils } from 'three'

import type { FrameDescriptor } from '$lib/motion/frameDescriptors'

/**
 * Convert `GetJointPositions` values, degrees for a rotational joint and millimetres for a
 * translational one, into the inputs RDK and the module store: radians and millimetres.
 *
 * Each value is matched to its joint through the arm's kinematics, the same way RDK's arm client
 * does, because the reply carries no units of its own.
 *
 * @returns `undefined` when any value has no joint in `descriptors` to say what its unit is.
 */
export const armInputsFromJointPositions = (
	descriptors: readonly FrameDescriptor[],
	arm: string,
	positions: readonly number[]
): number[] | undefined => {
	const motionByIndex = new Map<number, 'rotational' | 'translational'>()

	for (const descriptor of descriptors) {
		// A mimic joint borrows its source's index, so only the source says what that column holds.
		if (descriptor.kind !== 'joint' || descriptor.componentName !== arm || descriptor.mimic) {
			continue
		}
		motionByIndex.set(descriptor.jointIndex, descriptor.motion)
	}

	const inputs: number[] = []

	for (const [index, position] of positions.entries()) {
		const motion = motionByIndex.get(index)
		if (motion === undefined) return undefined
		inputs.push(motion === 'rotational' ? MathUtils.degToRad(position) : position)
	}

	return inputs
}
