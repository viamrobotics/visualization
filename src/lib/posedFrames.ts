import type { ConfigurableTrait, Entity, World } from 'koota'

import type { FrameDescriptor, JointFrameDescriptor } from '#lib/motion/frameDescriptors.js'
import type { TrajectoryStep } from '#lib/motion/jointPose.js'

import { hierarchy, traits } from '#lib/ecs/index.js'
import { descriptorLocalPose } from '#lib/motion/jointPose.js'

/** A spawned joint frame and the descriptor that says where it sits for a given set of inputs. */
export interface PosedJoint {
	descriptor: JointFrameDescriptor
	entity: Entity
}

/**
 * Spawn one frame of a frame system, posed at `inputs`. The entity carries a `Name`, a parent and a
 * local `Matrix`, so the ECS composes its world matrix the same way it does any other frame, and new
 * inputs only have to rewrite the joints (see {@link applyInputs}).
 *
 * @param extraTraits Whatever the caller draws the frame with. Nothing beyond the pose is added here.
 */
export const spawnPosedFrame = (
	world: World,
	descriptor: FrameDescriptor,
	name: string,
	parent: string,
	inputs: TrajectoryStep,
	extraTraits: ConfigurableTrait[]
): Entity =>
	world.spawn(
		traits.Name(name),
		traits.Matrix(descriptorLocalPose(descriptor, inputs).toMatrix4()),
		...hierarchy.parentTraits(parent),
		...extraTraits
	)

/** The collider traits for a frame that has one, which is all of `Geometry` and its offset. */
export const descriptorGeometryTraits = (descriptor: FrameDescriptor): ConfigurableTrait[] => {
	const { geometry } = descriptor
	if (!geometry) return []

	const geometryTraits: ConfigurableTrait[] = [traits.Geometry(geometry)]
	if (geometry.center) geometryTraits.push(traits.Center(geometry.center))
	return geometryTraits
}

/**
 * Move posed frames to `inputs`: radians, or mm for a prismatic joint, per component. Only the
 * joints are rewritten, because only a joint's local pose depends on its inputs, and the ECS
 * recomposes everything below each one.
 */
export const applyInputs = (joints: readonly PosedJoint[], inputs: TrajectoryStep): void => {
	for (const { descriptor, entity } of joints) {
		if (!entity.isAlive()) continue

		const matrix = entity.get(traits.Matrix)
		if (!matrix) continue

		descriptorLocalPose(descriptor, inputs).toMatrix4(matrix)
		entity.changed(traits.Matrix)
	}
}
