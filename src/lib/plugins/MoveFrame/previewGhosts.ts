import { type ConfigurableTrait, type Entity, type World } from 'koota'
import { Color } from 'three'

import type { FrameDescriptor, JointFrameDescriptor } from '$lib/motion/frameDescriptors'
import type { TrajectoryStep } from '$lib/motion/jointPose'

import { hierarchy, traits } from '$lib/ecs'
import { descriptorLocalPose } from '$lib/motion/jointPose'

import { MOVE_GHOST_COLOR } from './moveGhostColor'
import { previewName } from './previewNames'
import { PreviewGhost } from './traits'

/**
 * Lower than the staged-goal ghost's 0.5: the two are on screen together, a whole ghosted machine
 * behind the single ghosted subtree at the goal, and the goal is the thing being decided on.
 */
const PREVIEW_OPACITY = 0.35

/** Matches `moveGhosts`: `traits.Color` is read back through `Color.setRGB`, which does not convert. */
const ghostColor = new Color(MOVE_GHOST_COLOR)

/** A joint twin and the descriptor that says where it sits at a given step. */
interface PreviewJoint {
	descriptor: JointFrameDescriptor
	entity: Entity
}

export interface PreviewGhosts {
	/** Every twin the preview owns, root-most first, which is the order teardown wants. */
	entities: Entity[]
	/** The twins a step rewrites. Static frames hold still for the whole scrub. */
	joints: PreviewJoint[]
	/** How many twins carry geometry. Zero means the preview would draw nothing at all. */
	drawn: number
}

export const createPreviewGhosts = (): PreviewGhosts => ({ entities: [], joints: [], drawn: 0 })

/**
 * Three orders above the noise trajectory optimization leaves on a component the plan holds still
 * (up to 8.3e-10 rad in `salad-plan.json`), and below any prismatic slide worth ghosting.
 */
const MOTION_TOLERANCE = 1e-6

/**
 * The components whose joint values actually change over the plan. RDK answers with a column for
 * every component in the frame system, not just the ones it moved.
 */
const movingComponents = (trajectory: readonly TrajectoryStep[]): Set<string> => {
	const moving = new Set<string>()
	const [first] = trajectory
	if (!first) return moving

	for (const [component, values] of Object.entries(first)) {
		const changes = trajectory.some((step) => {
			// `hasOwn`, not a plain index: a step that does not own the component reads through to
			// `Object.prototype`, where `toString` reads back as a function whose `.length` is a
			// valid DoF count.
			if (!Object.hasOwn(step, component)) return true

			const other = step[component]
			return (
				other.length !== values.length ||
				values.some((value, index) => Math.abs(value - other[index]) > MOTION_TOLERANCE)
			)
		})
		if (changes) moving.add(component)
	}

	// `hasOwn`, not `in`: `in` walks the prototype chain, so `'toString' in first` is true even when
	// no step names a `toString` component.
	for (const step of trajectory) {
		for (const component of Object.keys(step)) {
			if (!Object.hasOwn(first, component)) moving.add(component)
		}
	}

	return moving
}

/**
 * Whether this frame moves under this plan: whether it is a joint the plan turns, or hangs below
 * one. The walk is what keeps a mounted gripper, which owns no column of its own while the arm
 * joints above it do.
 */
const drivenByMovingJoint = (
	name: string,
	byName: ReadonlyMap<string, FrameDescriptor>,
	moving: ReadonlySet<string>,
	memo: Map<string, boolean>
): boolean => {
	const cached = memo.get(name)
	if (cached !== undefined) return cached
	// Seeded before recursing, which doubles as the cycle guard: a loop cannot reach a joint, so
	// `false` is also its right answer.
	memo.set(name, false)

	const descriptor = byName.get(name)
	// A joint whose component is held still is not the end of the walk: an ancestor may still move,
	// as on a gripper bolted to a moving arm.
	const driven =
		descriptor !== undefined &&
		((descriptor.kind === 'joint' && moving.has(descriptor.componentName)) ||
			drivenByMovingJoint(descriptor.parent, byName, moving, memo))

	memo.set(name, driven)
	return driven
}

/**
 * Frame names the user has hidden, read off the live entity that carries each name.
 *
 * The `InheritedInvisible` cascade reaches a ghost only through `ChildOf`, and the ghost chain is a
 * sibling of the live one rather than a subtree of it. Hiding the frame the preview hangs off does
 * carry, because that frame is a real ancestor. Hiding one of the moving links does not, so the
 * names are matched here instead.
 */
const hiddenFrameNames = (world: World): Set<string> => {
	const hidden = new Set<string>()

	for (const entity of world.query(traits.Name)) {
		if (!entity.has(traits.Invisible) && !entity.has(traits.InheritedInvisible)) continue
		const name = entity.get(traits.Name)
		if (name !== undefined) hidden.add(name)
	}

	return hidden
}

/**
 * Fills `ghosts` in place: the caller holds the only handle it will ever tear down by.
 *
 * Every frame the plan moves gets a twin, not only the ones that draw. A joint and a geometry-less
 * mount carry a transform the frames below them compose against, so leaving them out would strand
 * everything under them at the wrong pose.
 *
 * A previewed plan drawn as a ghost twin of every frame it moves, laid over the live machine rather
 * than replacing it: the real arm is not moving, and animating its frames would say otherwise. The
 * twins are ordinary frames. They carry a `Name`, a parent and a local `Matrix`, so the ECS
 * composes their world matrices the same way it does the live ones, and a step only has to rewrite
 * the joints.
 *
 * That frame is one this plan holds still, so wherever the machine has it is where the preview
 * should hang, and hiding or moving it carries the whole preview along.
 */
export const spawnPreviewGhosts = (
	world: World,
	descriptors: FrameDescriptor[],
	trajectory: readonly TrajectoryStep[],
	ghosts: PreviewGhosts
): void => {
	clearPreviewGhosts(ghosts)

	const byName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
	const moving = movingComponents(trajectory)
	const hidden = hiddenFrameNames(world)
	const memo = new Map<string, boolean>()

	const previewed = new Set<string>()
	for (const descriptor of descriptors) {
		if (drivenByMovingJoint(descriptor.name, byName, moving, memo)) previewed.add(descriptor.name)
	}

	const start = trajectory[0] ?? {}

	for (const descriptor of descriptors) {
		if (!previewed.has(descriptor.name)) continue

		// The prefix stops at the edge of the previewed set, so the topmost twins parent to the live
		// frame they branch from.
		const parent = previewed.has(descriptor.parent)
			? previewName(descriptor.parent)
			: descriptor.parent

		const drawable: ConfigurableTrait[] = []
		if (descriptor.kind === 'static' && descriptor.geometry && !hidden.has(descriptor.name)) {
			drawable.push(
				traits.Geometry(descriptor.geometry),
				traits.Color({ r: ghostColor.r, g: ghostColor.g, b: ghostColor.b }),
				traits.Opacity(PREVIEW_OPACITY)
			)

			const center = descriptor.geometry.center
			if (center) drawable.push(traits.Center(center))
		}

		const entity = world.spawn(
			traits.Name(previewName(descriptor.name)),
			traits.NonSelectable,
			traits.Matrix(descriptorLocalPose(descriptor, start).toMatrix4()),
			PreviewGhost,
			...hierarchy.parentTraits(parent),
			...drawable
		)

		ghosts.entities.push(entity)
		if (drawable.length > 0) ghosts.drawn += 1
		if (descriptor.kind === 'joint') ghosts.joints.push({ descriptor, entity })
	}
}

/**
 * Move the preview to one step of the plan. Only the joints are rewritten, because only a joint's
 * local pose depends on the step, and the ECS recomposes everything below each one.
 */
export const applyPreviewStep = (ghosts: PreviewGhosts, stepInputs: TrajectoryStep): void => {
	for (const { descriptor, entity } of ghosts.joints) {
		if (!entity.isAlive()) continue

		const matrix = entity.get(traits.Matrix)
		if (!matrix) continue

		descriptorLocalPose(descriptor, stepInputs).toMatrix4(matrix)
		entity.changed(traits.Matrix)
	}
}

/** Drop every twin. Call when the preview is discarded or the panel unmounts. */
export const clearPreviewGhosts = (ghosts: PreviewGhosts): void => {
	for (const entity of ghosts.entities) {
		if (entity.isAlive()) entity.destroy()
	}
	ghosts.entities.length = 0
	ghosts.joints.length = 0
	ghosts.drawn = 0
}
