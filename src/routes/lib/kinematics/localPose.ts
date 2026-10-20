import type { PlainMessage } from '@bufbuild/protobuf'

import type { Pose } from '$lib/buf/common/v1/common_pb'
import type { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import { IDENTITY_POSE as IDENTITY, matrixToPose, poseToMatrix } from './poseMatrix'

type PoseMessage = PlainMessage<Pose>

/**
 * The assembly-frame pose of the frame `parent` names, with every joint at zero: identity for the
 * model (`''`), and the joint's `origin` for a joint.
 *
 * @throws For a `parent` that names no joint.
 */
export const parentWorld0 = (spec: KinematicsSpec, parent: string): PoseMessage => {
	if (parent === '') return { ...IDENTITY }
	const joint = spec.joints.find((candidate) => candidate.id === parent)
	if (!joint) throw new Error(`parent "${parent}" names no joint in ${spec.name}`)
	return { ...IDENTITY, ...joint.origin }
}

/** `assemblyPose` relative to `parent`: `inverse(parentWorld0) ∘ assemblyPose`. An absent pose is identity. */
export const toLocal = (
	spec: KinematicsSpec,
	parent: string,
	assemblyPose: PoseMessage | undefined
): PoseMessage => {
	const parentPose = parentWorld0(spec, parent)
	if (parent === '') return { ...IDENTITY, ...assemblyPose }
	const inverse = poseToMatrix(parentPose).invert()
	return matrixToPose(inverse.multiply(poseToMatrix(assemblyPose)))
}

/** The assembly-frame pose of a pose given relative to `parent`: `parentWorld0 ∘ localPose`. */
export const toAssembly = (
	spec: KinematicsSpec,
	parent: string,
	localPose: PoseMessage
): PoseMessage => {
	const parentPose = parentWorld0(spec, parent)
	if (parent === '') return { ...IDENTITY, ...localPose }
	return matrixToPose(poseToMatrix(parentPose).multiply(poseToMatrix(localPose)))
}
