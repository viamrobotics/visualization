import type { PlainMessage } from '@bufbuild/protobuf'

import type { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import { Pose } from '$lib/buf/common/v1/common_pb'

import { matrixToPose, poseToMatrix } from './poseMatrix'

/** `jointId` and every joint whose parent chain reaches it. A parent cycle cannot loop, since each pass only adds. */
const subtreeJointIds = (spec: KinematicsSpec, jointId: string): Set<string> => {
	const subtree = new Set([jointId])
	let hasGrown = true
	while (hasGrown) {
		hasGrown = false
		for (const candidate of spec.joints) {
			if (subtree.has(candidate.id) || !subtree.has(candidate.parent)) continue
			subtree.add(candidate.id)
			hasGrown = true
		}
	}
	return subtree
}

/**
 * Moves everything that rides joint `jointId` by the rigid change from its current origin to
 * `nextOrigin`: every link, joint, and the TCP whose parent chain reaches the joint. Poses are in the
 * assembly frame, so each is premultiplied by `nextOrigin ∘ inverse(origin)`. Mutates `draft`, and
 * leaves the joint's own origin to the caller. A no-op for an id that names no joint.
 */
export const carryJointSubtree = (
	draft: KinematicsSpec,
	jointId: string,
	nextOrigin: PlainMessage<Pose>
): void => {
	const joint = draft.joints.find((candidate) => candidate.id === jointId)
	if (!joint) return

	const delta = poseToMatrix(nextOrigin).multiply(poseToMatrix(joint.origin).invert())
	const carry = (pose: PlainMessage<Pose> | undefined) =>
		new Pose(matrixToPose(delta.clone().multiply(poseToMatrix(pose))))

	const subtree = subtreeJointIds(draft, jointId)

	for (const candidate of draft.joints) {
		if (candidate.id !== jointId && subtree.has(candidate.id)) {
			candidate.origin = carry(candidate.origin)
		}
	}
	for (const link of draft.links) {
		if (subtree.has(link.parent)) link.origin = carry(link.origin)
	}
	if (subtree.has(draft.tcpParent)) draft.tcpPose = carry(draft.tcpPose)
}
