import { UuidTool } from 'uuid-tool'

import type { FrameDescriptor } from '$lib/motion/frameDescriptors'
import type { TrajectoryStep } from '$lib/motion/jointPose'

import { PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { buildFrameDescriptors } from '$lib/motion/frameDescriptors'
import { descriptorLocalPose } from '$lib/motion/jointPose'

import type { ParsedPlan } from './parse-plan'

import { PlanParseError } from './parse-plan'
import { worldStateObstacleTransforms } from './world-state-obstacles'

const descriptorToTransform = (
	descriptor: FrameDescriptor,
	stepInputs: TrajectoryStep
): Transform =>
	new Transform({
		referenceFrame: descriptor.name,
		poseInObserverFrame: new PoseInFrame({
			referenceFrame: descriptor.parent,
			pose: descriptorLocalPose(descriptor, stepInputs),
		}),
		physicalObject: descriptor.kind === 'static' ? (descriptor.geometry ?? undefined) : undefined,
		uuid: descriptor.uuid,
	})

// Reconcile keys on `Transform.uuid`, so the snapshot uuid is unused. This helper keeps one construction path.
const snapshotUuid = (): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(UuidTool.toBytes(crypto.randomUUID()))

export const transformsToSnapshot = (transforms: Transform[]): Snapshot =>
	new Snapshot({ transforms, uuid: snapshotUuid() })

/**
 * Bytes bridge protobuf-es (this package) and protobuf-ts (host) without sharing generated types.
 * One inner array = one trajectory step.
 */
export const transformBytesToSnapshots = (transformsPerStep: Uint8Array[][]): Snapshot[] =>
	transformsPerStep.map((step) =>
		transformsToSnapshot(step.map((bytes) => Transform.fromBinary(bytes)))
	)

/**
 * The snapshot half of the client-side fallback described in `parse-plan.ts`. Pairs the frame
 * chain from `$lib/motion/frameDescriptors` with the plan's trajectory to produce one
 * `Snapshot` per step.
 *
 * @throws `PlanParseError` for a plan it cannot draw as well as one it cannot read, so a caller
 * has one error type to present and the reason survives to the user.
 */
export const parsedPlanToSnapshots = (plan: ParsedPlan): Snapshot[] => {
	try {
		const descriptors = buildFrameDescriptors(plan)

		// Built once and shared by every step rather than per-step: reconcile keys on `Transform.uuid`,
		// so stable uuids let obstacles spawn on the first step and survive a scrub untouched.
		const obstacles = worldStateObstacleTransforms(plan)

		return plan.trajectory.map((stepInputs) =>
			transformsToSnapshot([
				...descriptors.map((descriptor) => descriptorToTransform(descriptor, stepInputs)),
				...obstacles,
			])
		)
	} catch (error) {
		if (error instanceof PlanParseError) throw error
		// Both callers show a `PlanParseError`'s message and swallow anything else, so a malformed
		// frame reaches the user as the reason it failed rather than as "failed to parse". The
		// message carries no prefix of its own: each caller already says which plan failed.
		throw new PlanParseError(
			error instanceof Error ? error.message : 'the plan could not be drawn',
			{ cause: error }
		)
	}
}
