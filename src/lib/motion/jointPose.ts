/**
 * The one piece of forward kinematics a trajectory step needs: it carries joint values, not poses,
 * so this reproduces RDK's `rotationalFrame.Transform` and `translationalFrame.Transform`.
 */

import { Quaternion, Vector3 } from 'three'

import { Pose } from '$lib/math'

import type { JointFrameDescriptor } from './frameDescriptors'

/** One step: joint values per component, positional by joint index. Radians, or mm if prismatic. */
export type TrajectoryStep = Record<string, number[]>

const quat = new Quaternion()
const vec3 = new Vector3()

/** RDK reads the step value as radians for a revolute joint and millimeters for a prismatic one. */
export const computeJointPose = (descriptor: JointFrameDescriptor, value: number): Pose => {
	const { axis } = descriptor
	// `axis` comes off an unchecked cast in `frameDescriptors.ts`, so the type's guarantee of a
	// well-formed vector does not hold at runtime.
	if (!axis || !Number.isFinite(axis.X) || !Number.isFinite(axis.Y) || !Number.isFinite(axis.Z)) {
		throw new Error(`joint "${descriptor.name}" has a missing or non-numeric axis`)
	}

	// The JSON does not guarantee a unit axis. RDK normalizes a translational frame on unmarshal and a
	// rotational one at use, inside `R4AA.ToQuat`; normalizing once here covers both.
	vec3.set(axis.X, axis.Y, axis.Z)
	// Three's `normalize()` guards `length() || 1`, so a zero axis would pass through it unchanged and
	// yield a meaningless quaternion in silence.
	// RDK's `R4AA.Normalize` panics here too. `translationalFrame` instead keeps `r3.Vector.Normalize`'s
	// zero vector and draws a motionless frame. We reject both rather than draw a joint that never moves.
	if (vec3.lengthSq() === 0) {
		throw new Error(`joint "${descriptor.name}" has a zero-length axis`)
	}
	vec3.normalize()

	if (descriptor.motion === 'translational') {
		return new Pose(vec3.x * value, vec3.y * value, vec3.z * value)
	}

	quat.setFromAxisAngle(vec3, value)
	return new Pose().setFromQuaternion(quat)
}

/**
 * A step addresses joints positionally per component; a missing column reads as zero, where RDK's
 * `FrameSystem.Transform` errors instead.
 */
export const jointValueAt = (
	descriptor: JointFrameDescriptor,
	stepInputs: TrajectoryStep
): number => {
	const column = stepInputs[descriptor.componentName]?.[descriptor.jointIndex] ?? 0
	const { mimic } = descriptor
	// A mimic joint has no column of its own, so `jointIndex` addresses its source. `offset` is in
	// position units, not degrees: RDK's `MimicConfig.ValueOffset` never passes through `DegToRad`.
	return mimic ? mimic.multiplier * column + mimic.offset : column
}

/**
 * The frame's pose relative to its parent at `stepInputs`, whichever kind of frame it is.
 *
 * The static branch stands in for `referenceframe/frame.go`'s `staticFrame.Transform`, which
 * returns its stored pose directly and errors when it is handed inputs at all.
 *
 * @returns A fresh `Pose` the caller owns. A static frame's is cloned rather than handed out,
 * because the descriptor keeps its copy for every later step and a caller that wrote into a
 * borrowed one would move the frame for all of them.
 */
export const descriptorLocalPose = (
	descriptor: { kind: 'static'; localPose: Pose } | JointFrameDescriptor,
	stepInputs: TrajectoryStep
): Pose =>
	descriptor.kind === 'static'
		? descriptor.localPose.clone()
		: computeJointPose(descriptor, jointValueAt(descriptor, stepInputs))
