import type { FrameDescriptor } from './frameDescriptors'
import type { TrajectoryStep } from './jointPose'

const RAD_TO_DEG = 180 / Math.PI

/**
 * Joint degrees per frame. At the preview's frame interval this works out to a plausible arm speed,
 * which is the only claim being made — the real duration is unknowable from a trajectory.
 */
export const DEFAULT_DEGREES_PER_FRAME = 1.5

/**
 * Millimetres per frame: the arc {@link DEFAULT_DEGREES_PER_FRAME} sweeps at a 191 mm mid-link
 * radius. Erring short only over-samples a prismatic axis; erring long under-samples it into a jump.
 */
export const DEFAULT_MILLIMETRES_PER_FRAME = 5

/** How a joint's values are measured — the same two kinds a `JointFrameDescriptor` distinguishes. */
export type JointMotion = 'rotational' | 'translational'

/**
 * Which joints are prismatic, indexed the way a trajectory step is: `motions.get('gantry')[0]`.
 * Anything absent reads as rotational, which is what every joint in the captured plans is.
 */
export type JointMotions = ReadonlyMap<string, readonly JointMotion[]>

export interface FrameBudget {
	/** Degrees of revolute travel one frame represents. */
	degrees?: number
	/** Millimetres of prismatic travel one frame represents. */
	millimetres?: number
	motions?: JointMotions
}

/**
 * The joint kinds a plan's descriptors describe, in the shape {@link FrameBudget} wants. Mimics are
 * skipped: a mimic's `jointIndex` addresses its source's column, so its motion would mislabel it.
 */
export const jointMotionsOf = (descriptors: readonly FrameDescriptor[]): JointMotions => {
	const motions = new Map<string, JointMotion[]>()

	for (const descriptor of descriptors) {
		if (descriptor.kind !== 'joint' || descriptor.mimic) continue

		const kinds = motions.get(descriptor.componentName) ?? []
		kinds[descriptor.jointIndex] = descriptor.motion
		motions.set(descriptor.componentName, kinds)
	}

	return motions
}

/**
 * Backstop for a plan beyond anything observed; the worst real plan came to 236 frames. It bounds
 * interpolation only, since every planned waypoint keeps its own frame whatever this is set to.
 */
export const MAX_INTERPOLATED_FRAMES = 2000

export interface PreviewFrames {
	/** What to render, in order. Contains every planned waypoint, plus any frames added between. */
	steps: TrajectoryStep[]
	/**
	 * Where each planned waypoint landed in `steps`. Always starts at 0 and ends at the last index,
	 * so a scrubber can mark which frames are real data and which are drawn between them.
	 */
	waypoints: number[]
	/**
	 * How much the cap stretched each frame: 1 when the requested budget was met, higher when a plan
	 * long enough to exceed {@link MAX_INTERPOLATED_FRAMES} had to be coarsened to fit.
	 */
	coarsening: number
}

/**
 * The largest single-joint change between two steps, with no production caller: the spec
 * measures captured plans against it, while {@link segmentFrameCost} budgets the frames.
 */
export const largestJointDelta = (from: TrajectoryStep, to: TrajectoryStep): number => {
	let worst = 0

	for (const [component, start] of Object.entries(from)) {
		const end = to[component]
		if (!end) continue

		for (const [index, value] of start.entries()) {
			const target = end[index]
			if (target === undefined) continue
			worst = Math.max(worst, Math.abs(target - value))
		}
	}

	return worst
}

/**
 * `from` and `to` blended at `alpha`, over the union of both steps' components. Not angle-aware:
 * mirrors RDK's `interpolateInputs` in `referenceframe/input.go`, which computes
 * `j1+((to[i]-j1)*by)` per joint, the same expression as line 128, so wrapping would draw a path
 * it never validated.
 */
export const lerpTrajectoryStep = (
	from: TrajectoryStep,
	to: TrajectoryStep,
	alpha: number
): TrajectoryStep => {
	// `constructor` and `__proto__` are legal RDK resource names. On a plain object the first reads a
	// function off the prototype and the second hits the prototype setter, so neither stays data.
	const blended = Object.create(null) as TrajectoryStep

	for (const component of new Set([...Object.keys(from), ...Object.keys(to)])) {
		const start = Object.hasOwn(from, component) ? from[component] : undefined
		const end = Object.hasOwn(to, component) ? to[component] : undefined

		if (!start) {
			if (end) blended[component] = [...end]
			continue
		}
		if (!end) {
			blended[component] = [...start]
			continue
		}

		blended[component] = start.map((value, index) => {
			const target = end[index]
			return target === undefined ? value : value + (target - value) * alpha
		})

		// A component that gained joints between steps would otherwise lose them here.
		if (end.length > start.length) blended[component].push(...end.slice(start.length))
	}

	return blended
}

/**
 * A budget figure that can be divided by, or the default. `?? fallback` only catches null and
 * undefined: a zero pins every plan to the frame cap, and a `NaN` collapses every segment to one
 * frame.
 */
const perFrame = (value: number | undefined, fallback: number): number =>
	value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback

/**
 * What a segment costs in frames: each joint's change over the budget for its own kind, largest
 * quotient wins. Normalizing before the max is the point: a raw max lets a millimetre outweigh a
 * radian 57×.
 */
export const segmentFrameCost = (
	from: TrajectoryStep,
	to: TrajectoryStep,
	budget: FrameBudget = {}
): number => {
	const degrees = perFrame(budget.degrees, DEFAULT_DEGREES_PER_FRAME)
	const millimetres = perFrame(budget.millimetres, DEFAULT_MILLIMETRES_PER_FRAME)

	let worst = 0

	for (const [component, start] of Object.entries(from)) {
		const end = to[component]
		if (!end) continue
		const kinds = budget.motions?.get(component)

		for (const [index, value] of start.entries()) {
			const target = end[index]
			if (target === undefined) continue

			const delta = Math.abs(target - value)
			const cost =
				kinds?.[index] === 'translational' ? delta / millimetres : (delta * RAD_TO_DEG) / degrees
			worst = Math.max(worst, cost)
		}
	}

	return worst
}

/** One frame per planned waypoint — the trajectory exactly as the planner returned it. */
export const waypointFrames = (trajectory: TrajectoryStep[]): PreviewFrames => ({
	steps: trajectory,
	waypoints: trajectory.map((_, index) => index),
	coarsening: 1,
})

/**
 * Frames spread across `trajectory` at roughly one budget's worth of joint travel each, so
 * playback reads at a constant speed whether the planner returned 2 waypoints or 225. A segment
 * shorter than that, a zero-length one included, still gets its frame from `steps.push(to)`
 * below.
 */
export const interpolatedFrames = (
	trajectory: TrajectoryStep[],
	budget: FrameBudget = {}
): PreviewFrames => {
	if (trajectory.length < 2) return waypointFrames(trajectory)

	const travel: number[] = []
	let total = 0
	for (let step = 1; step < trajectory.length; step += 1) {
		const segment = segmentFrameCost(trajectory[step - 1]!, trajectory[step]!, budget)
		travel.push(segment)
		total += segment
	}

	// Coarsen rather than truncate: every segment still gets its frames, just fewer of them.
	const resolution = Math.max(1, total / MAX_INTERPOLATED_FRAMES)

	const steps: TrajectoryStep[] = [trajectory[0]!]
	const waypoints: number[] = [0]

	for (const [index, segment] of travel.entries()) {
		const from = trajectory[index]!
		const to = trajectory[index + 1]!
		// `max(1, …)` keeps this a usable divisor below rather than granting the minimum frame, which
		// `steps.push(to)` already does — a zero-length segment would otherwise `ceil` to 0.
		const divisions = Math.max(1, Math.ceil(segment / resolution))

		// The segment's own start is already in `steps` as the previous segment's end, so this walks
		// the interior and finishes on `to` exactly rather than on a blend that rounds to it.
		for (let division = 1; division < divisions; division += 1) {
			steps.push(lerpTrajectoryStep(from, to, division / divisions))
		}
		steps.push(to)
		waypoints.push(steps.length - 1)
	}

	return { steps, waypoints, coarsening: resolution }
}
