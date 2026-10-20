import type { Joint } from '$lib/buf/kinematics/v1/spec_pb'

type JointNode = Pick<Joint, 'id' | 'parent' | 'mimic'>

/** The ids of a joint's descendants, through any depth. */
const descendantsOf = (joints: readonly JointNode[], id: string): Set<string> => {
	const found = new Set<string>()
	const pending = [id]
	while (pending.length > 0) {
		const current = pending.pop()
		for (const joint of joints) {
			if (joint.parent === current && !found.has(joint.id)) {
				found.add(joint.id)
				pending.push(joint.id)
			}
		}
	}
	return found
}

/** Joint ids a joint can ride on: every joint except itself and its descendants, which would cycle. */
export const parentOptions = (joints: readonly JointNode[], id: string): string[] => {
	const excluded = descendantsOf(joints, id)
	return joints
		.filter((joint) => joint.id !== id && !excluded.has(joint.id))
		.map((joint) => joint.id)
}

/** Joint ids a joint can mimic: not itself, and not a joint that is already a mimic. */
export const mimicOptions = (joints: readonly JointNode[], id: string): string[] =>
	joints.filter((joint) => joint.id !== id && !joint.mimic).map((joint) => joint.id)

/** Joint ids a link or the TCP frame can ride on. */
export const attachOptions = (joints: readonly JointNode[]): string[] =>
	joints.map((joint) => joint.id)
