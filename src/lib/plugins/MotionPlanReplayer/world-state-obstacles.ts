import type { JsonValue, PartialMessage } from '@bufbuild/protobuf'

import { UuidTool } from 'uuid-tool'

import {
	type Pose as CommonPose,
	type Geometry,
	PoseInFrame,
	Transform,
	WorldState,
} from '$lib/buf/common/v1/common_pb'
import { Pose } from '$lib/math'
import { parseGeometry } from '$lib/motion/frameDescriptors'

import type { ObstaclesInWorldFrame, ParsedPlan } from './parse-plan'

// Prefix avoids colliding with frame names that share an obstacle label (pirouette: pallet).
const namespaced = (label: string, fallback: string): string => `obstacle:${label || fallback}`

const newUuid = (): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(UuidTool.toBytes(crypto.randomUUID()))

// `PartialMessage` so both `$lib/math`'s Pose and a decoded proto Pose fit — the former is the
// identity default, the latter comes off a supplemental transform.
const obstacleTransform = (
	name: string,
	parent: string,
	pose: PartialMessage<CommonPose>,
	geometry: Geometry
): Transform =>
	new Transform({
		referenceFrame: name,
		poseInObserverFrame: new PoseInFrame({ referenceFrame: parent || 'world', pose }),
		physicalObject: geometry,
		uuid: newUuid(),
	})

const fromObstaclesInWorldFrame = (payload: ObstaclesInWorldFrame | undefined): Transform[] => {
	if (!payload) return []

	return payload.geometries.flatMap((geom, index) => {
		const geometry = parseGeometry(geom, `obstacles_in_world_frame[${index}]`)
		if (!geometry) return []

		return [
			obstacleTransform(
				namespaced(geometry.label, String(index)),
				payload.frame,
				// Pose lives on the geometry center, not the transform.
				new Pose(),
				geometry
			),
		]
	})
}

const fromWorldState = (payload: unknown): Transform[] => {
	if (!payload || typeof payload !== 'object') return []

	let parsed: WorldState
	try {
		// Not optional: protobuf-es rejects unknown JSON fields by default, so one field added to the
		// proto would erase every obstacle rather than the one it appears on.
		parsed = WorldState.fromJson(payload as JsonValue, { ignoreUnknownFields: true })
	} catch (error) {
		console.warn('[MotionPlanReplayer] skipping world_state obstacles:', error)
		return []
	}

	const fromObstacles = parsed.obstacles.flatMap((group, groupIndex) =>
		group.geometries.map((geometry, index) =>
			obstacleTransform(
				namespaced(geometry.label, `${groupIndex}-${index}`),
				group.referenceFrame,
				// Pose lives on the geometry center, not the transform.
				new Pose(),
				geometry
			)
		)
	)

	// Geometry-bearing transforms only — bare frames are plumbing with nothing to draw.
	const fromTransforms = parsed.transforms
		.filter((transform) => transform.physicalObject !== undefined)
		.map((transform, index) =>
			obstacleTransform(
				namespaced(transform.referenceFrame, `transform-${index}`),
				transform.poseInObserverFrame?.referenceFrame ?? 'world',
				transform.poseInObserverFrame?.pose ?? new Pose(),
				transform.physicalObject!
			)
		)

	return [...fromObstacles, ...fromTransforms]
}

/**
 * Obstacles outside `frame_system`. RDK writes them under two keys that decode differently (see
 * `parse-plan.ts`), so each arrives on its own field and gets its own decoder here. Draw contract
 * matches `draw/geometries_in_frame.go`'s `ToTransforms`: namespaced label, parented to the
 * observed frame. WorldState `obstacles` and `transforms` are the same thing in different shapes,
 * so both draw.
 */
export const worldStateObstacleTransforms = (plan: ParsedPlan): Transform[] => [
	...fromWorldState(plan.worldState),
	...fromObstaclesInWorldFrame(plan.obstaclesInWorldFrame),
]
