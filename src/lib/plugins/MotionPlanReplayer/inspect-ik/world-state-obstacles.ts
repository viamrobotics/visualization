import type { JsonValue } from '@bufbuild/protobuf'

import { UuidTool } from 'uuid-tool'

import { Geometry, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
// Not the generated Pose: this one defaults to the 0,0,1,0 orientation vector, where the proto's
// zero value is a degenerate all-zero axis.
import { Pose } from '$lib/math'

/** Frame names here are shared with `frame_system.frames` (`pallet`, `pick-station`) and the ECS
 * name index is global, so obstacles get their own namespace. */
export const OBSTACLE_PREFIX = 'obstacle'

type WorldStateJson = {
	obstacles?: Array<{ referenceFrame?: string; geometries?: unknown[] }>
}

const newUuid = (): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(UuidTool.toBytes(crypto.randomUUID()))

/**
 * Builds drawable transforms for obstacles that live only in `world_state`.
 *
 * `world_state` is protobuf-JSON (viam.common.v1.WorldState): geometry type is a oneof keyed by
 * field name, dimensions sit under `box.dimsMm`, the pose is an orientation vector in `center`, and
 * the label is lowercase. That is a different encoding from the Go-marshalled geometry
 * `parseGeometry` in build-frame-descriptors.ts reads, which is why this decodes through
 * protobuf-es rather than reusing it.
 *
 * Obstacles RDK already flattened into `frame_system.frames` carry inline geometry and render
 * through the normal descriptor path; this covers only the ones it did not flatten.
 */
export const worldStateObstacleTransforms = (worldState: unknown): Transform[] => {
	const obstacles = (worldState as WorldStateJson | undefined)?.obstacles
	if (!Array.isArray(obstacles)) return []

	const transforms: Transform[] = []

	for (const obstacle of obstacles) {
		const geometries = obstacle?.geometries
		if (!Array.isArray(geometries)) continue

		for (const [index, raw] of geometries.entries()) {
			let geometry: Geometry
			try {
				// protobuf-es rejects unknown fields by default, which would drop every obstacle the
				// moment RDK adds a field ahead of our vendored proto.
				geometry = Geometry.fromJson(raw as JsonValue, { ignoreUnknownFields: true })
			} catch (error) {
				console.warn('[InspectIK] skipping unreadable world_state geometry:', error)
				continue
			}

			transforms.push(
				new Transform({
					referenceFrame: `${OBSTACLE_PREFIX}/${geometry.label || `geometry-${index}`}`,
					// The geometry's own `center` already positions it within the obstacle's
					// reference frame, so the transform itself is identity.
					poseInObserverFrame: new PoseInFrame({
						referenceFrame: obstacle.referenceFrame || 'world',
						pose: new Pose(),
					}),
					physicalObject: geometry,
					uuid: newUuid(),
				})
			)
		}
	}

	return transforms
}
