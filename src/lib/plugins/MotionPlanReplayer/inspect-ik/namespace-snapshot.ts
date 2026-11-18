import { PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'

import { transformsToSnapshot } from '../plan-to-snapshots'

export const NAMESPACE_SEPARATOR = '/'

export const namespacedFrameName = (prefix: string, frame: string): string =>
	`${prefix}${NAMESPACE_SEPARATOR}${frame}`

/**
 * Prefixes every frame name in a snapshot so two copies of one kinematic chain can coexist.
 *
 * `resolveOrphans` (src/lib/ecs/hierarchy.ts) indexes name -> entity across the entire world, one
 * slot per name. Without a prefix the second copy's links parent onto the first copy's and the two
 * collapse into a single chain.
 *
 * World-parented frames are re-parented onto `prefix` itself, which the caller spawns as the pose
 * set's root: `parentTraits` yields no parent for 'world', so they would otherwise become a dozen
 * separate tree roots rather than one group that can be hidden with a single `Invisible`.
 */
export const namespaceSnapshot = (snapshot: Snapshot, prefix: string): Snapshot => {
	const transforms = snapshot.transforms.map((transform) => {
		const parent = transform.poseInObserverFrame?.referenceFrame ?? ''

		return new Transform({
			referenceFrame: namespacedFrameName(prefix, transform.referenceFrame),
			poseInObserverFrame: new PoseInFrame({
				referenceFrame:
					parent === '' || parent === 'world' ? prefix : namespacedFrameName(prefix, parent),
				pose: transform.poseInObserverFrame?.pose,
			}),
			physicalObject: transform.physicalObject,
			// Each pose set is built by its own `parsedPlanToSnapshots` call, and
			// `buildFrameDescriptors` mints fresh uuids per call, so these are already unique
			// across sets and can carry through untouched.
			uuid: transform.uuid,
		})
	})

	return transformsToSnapshot(transforms)
}
