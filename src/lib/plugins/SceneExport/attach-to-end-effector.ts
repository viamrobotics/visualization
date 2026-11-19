import { ownerOfInternalFrame } from '$lib/kinematicsFrames'

import type { ArticulationContext } from './articulate-component'
import type { SimBody } from './sim-scene'

/** Bodies hung directly off a component that are not part of its own kinematic model. */
export const mountedChildren = (
	componentName: string,
	bodiesByName: Map<string, SimBody>
): SimBody[] =>
	[...bodiesByName.values()].filter(
		(body) => body.parent === componentName && ownerOfInternalFrame(body.name) !== componentName
	)

/**
 * Moves the frames parented to a component onto its end effector. rdk mounts a component's
 * children at its end effector, but the scene draws the component at its mount. Left there, a child
 * would stay put while the arm moves.
 *
 * A child's configured pose is already its offset from the end effector, as rdk defines it, so that
 * is its origin. Its scene pose is not used: it includes the arm only while poses are being polled,
 * and each frame's poll lands at a different time.
 */
export const attachChildrenToEndEffector = (
	componentName: string,
	endEffectorName: string | undefined,
	{ bodiesByName, configPoseOf, notes }: ArticulationContext
) => {
	const children = mountedChildren(componentName, bodiesByName)
	if (children.length === 0) return

	if (!endEffectorName) {
		notes.push({ reason: 'end-effector-unknown', subject: componentName })
		return
	}

	for (const child of children) {
		const offset = configPoseOf(child.name)
		if (!offset) {
			notes.push({ reason: 'end-effector-offset-unknown', subject: child.name })
			continue
		}
		child.parent = endEffectorName
		child.origin = offset
	}
}
