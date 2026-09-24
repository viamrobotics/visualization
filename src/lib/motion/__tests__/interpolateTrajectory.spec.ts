import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/math'

import type { FrameDescriptor } from '../frameDescriptors'
import type { JointMotion, JointMotions } from '../interpolateTrajectory'
import type { TrajectoryStep } from '../jointPose'

import {
	DEFAULT_DEGREES_PER_FRAME,
	interpolatedFrames,
	jointMotionsOf,
	largestJointDelta,
	lerpTrajectoryStep,
	MAX_INTERPOLATED_FRAMES,
	segmentFrameCost,
	waypointFrames,
} from '../interpolateTrajectory'
import freeSpacePlan from './__fixtures__/plan-free-space.json'
import gantryPlan from './__fixtures__/plan-gantry.json'
import linearPlan from './__fixtures__/plan-linear-constrained.json'
import obstaclePlan from './__fixtures__/plan-synthetic-obstacle-routed.json'

const RAD_TO_DEG = 180 / Math.PI

const plans = {
	freeSpace: freeSpacePlan.plan as TrajectoryStep[],
	linear: linearPlan.plan as TrajectoryStep[],
	obstacle: obstaclePlan.plan as TrajectoryStep[],
	gantry: gantryPlan.plan as TrajectoryStep[],
}

/** The gantry rig's one prismatic axis; everything else in these fixtures is revolute. */
const GANTRY_MOTIONS: JointMotions = new Map([['gantry-1', ['translational'] as const]])

const segmentDegrees = (trajectory: TrajectoryStep[]) =>
	trajectory.slice(1).map((step, index) => largestJointDelta(trajectory[index]!, step) * RAD_TO_DEG)

describe('captured plans still have the shape these rules were built for', () => {
	it.each([
		['freeSpace', 2, 269, 271],
		['linear', 225, 7, 8],
		['obstacle', 21, 78, 79],
	] as const)('%s: %i steps, worst segment between %i° and %i°', (key, steps, lower, upper) => {
		const trajectory = plans[key]
		expect(trajectory).toHaveLength(steps)

		const worst = Math.max(...segmentDegrees(trajectory))
		expect(worst).toBeGreaterThan(lower)
		expect(worst).toBeLessThan(upper)
	})

	// Dividing a segment by its own length would be NaN here. Structural rather than incidental: a
	// CBiRRT-solved goal returns a path whose first node is the segment's start configuration.
	it('obstacle plans contain a zero-length segment', () => {
		expect(segmentDegrees(plans.obstacle).filter((d) => d === 0)).not.toHaveLength(0)
	})

	it('free-space plans do not', () => {
		expect(segmentDegrees(plans.freeSpace).filter((d) => d === 0)).toHaveLength(0)
	})

	it('every step of a plan carries the same columns', () => {
		for (const trajectory of Object.values(plans)) {
			const keys = trajectory.map((step) => Object.keys(step).toSorted().join(','))
			expect(new Set(keys).size).toBe(1)
		}
	})
})

describe('largestJointDelta', () => {
	it('reports the largest single-joint change, not the sum', () => {
		const travel = largestJointDelta({ arm: [0, 0, 0] }, { arm: [0.1, 0.5, -0.2] })
		expect(travel).toBeCloseTo(0.5)
	})

	it('spans every component in the step', () => {
		const travel = largestJointDelta({ arm: [0.1], gantry: [2] }, { arm: [0.2], gantry: [0] })
		expect(travel).toBeCloseTo(2)
	})

	it('ignores the zero-DoF frames a real trajectory carries', () => {
		const travel = largestJointDelta({ arm: [1], table: [] }, { arm: [1.5], table: [] })
		expect(travel).toBeCloseTo(0.5)
	})
})

/**
 * Neither guard can fire on a real reply, since `ToFrameSystemInputs` serializes every node of a
 * plan from one schema. They are pinned so a malformed one degrades instead of throwing or costing
 * `NaN`.
 */
describe('a step that does not carry the same columns as its neighbour', () => {
	it.each([
		['segmentFrameCost', segmentFrameCost],
		['largestJointDelta', largestJointDelta],
	])('%s skips a component the next step drops', (_label, cost) => {
		expect(cost({ arm: [0], gripper: [0] }, { arm: [0] })).toBe(0)
	})

	it.each([
		['segmentFrameCost', segmentFrameCost],
		['largestJointDelta', largestJointDelta],
	])('%s skips a joint the next step drops', (_label, cost) => {
		expect(cost({ arm: [0, 0] }, { arm: [0] })).toBe(0)
	})

	it('charges nothing for a component that appears only in the later step', () => {
		expect(segmentFrameCost({ arm: [0] }, { arm: [0], gripper: [Math.PI] })).toBe(0)
	})
})

describe('lerpTrajectoryStep', () => {
	const from: TrajectoryStep = { arm: [0, 10] }
	const to: TrajectoryStep = { arm: [1, -10] }

	it.each([
		[0, [0, 10]],
		[0.5, [0.5, 0]],
		[1, [1, -10]],
	])('blends each joint at t=%s', (alpha, expected) => {
		expect(lerpTrajectoryStep(from, to, alpha).arm).toEqual(expected)
	})

	it('leaves the endpoints untouched', () => {
		lerpTrajectoryStep(from, to, 0.5)
		expect(from.arm).toEqual([0, 10])
		expect(to.arm).toEqual([1, -10])
	})

	it.each([
		['only the start', { arm: [5] }, {}],
		['only the end', {}, { arm: [5] }],
	])('holds a component present in %s', (_label, start, end) => {
		expect(lerpTrajectoryStep(start, end, 0.5).arm).toEqual([5])
	})

	// Handing back an array the input plan still owns means an in-place edit of a frame rewrites the
	// plan itself.
	it.each([
		['only the start', true],
		['only the end', false],
	])('copies a component present in %s rather than aliasing it', (_label, onStart) => {
		const held = [5]
		const start: TrajectoryStep = onStart ? { arm: held } : {}
		const end: TrajectoryStep = onStart ? {} : { arm: held }

		expect(lerpTrajectoryStep(start, end, 0.5).arm).not.toBe(held)
	})

	it('carries joints a component gained between steps', () => {
		expect(lerpTrajectoryStep({ arm: [0, 0] }, { arm: [1, 1, 9] }, 0.5).arm).toEqual([0.5, 0.5, 9])
	})

	it('keeps joints a component lost between steps', () => {
		expect(lerpTrajectoryStep({ arm: [0, 10, 20] }, { arm: [1] }, 0.5).arm).toEqual([0.5, 10, 20])
	})

	it('blends straight across ±π rather than taking the short way round', () => {
		expect(lerpTrajectoryStep({ arm: [3] }, { arm: [3.4] }, 0.5).arm![0]).toBeCloseTo(3.2)
	})
})

describe('waypointFrames', () => {
	it("plays the planner's waypoints and nothing else", () => {
		const frames = waypointFrames(plans.obstacle)
		expect(frames.steps).toBe(plans.obstacle)
		expect(frames.waypoints).toHaveLength(plans.obstacle.length)
	})

	// Length alone leaves the contents free: every waypoint could point at frame 0 and the assertion
	// above would still hold.
	it('indexes every frame as a waypoint, in order', () => {
		expect(waypointFrames(plans.gantry).waypoints).toEqual([0, 1])
		expect(waypointFrames(plans.obstacle).waypoints).toEqual(
			plans.obstacle.map((_, index) => index)
		)
	})

	it('reports no coarsening, since it never subdivides', () => {
		expect(waypointFrames(plans.obstacle).coarsening).toBe(1)
		expect(waypointFrames([]).coarsening).toBe(1)
	})
})

describe('interpolatedFrames', () => {
	it.each(['freeSpace', 'linear', 'obstacle'] as const)(
		'keeps every planned waypoint of the %s plan, in order',
		(key) => {
			const planned = plans[key]
			const { steps, waypoints } = interpolatedFrames(planned)

			expect(waypoints).toHaveLength(planned.length)
			// By reference, not by value: `toEqual` also passes for a blend that lands on the waypoint,
			// which is what dropping the explicit `steps.push(to)` produces.
			for (const [index, frame] of waypoints.entries()) {
				expect(steps[frame]).toBe(planned[index])
			}
			expect(waypoints[0]).toBe(0)
			expect(waypoints.at(-1)).toBe(steps.length - 1)
		}
	)

	it.each(['freeSpace', 'linear', 'obstacle'] as const)(
		'holds the %s plan to the requested resolution',
		(key) => {
			const { steps } = interpolatedFrames(plans[key])
			const worst = Math.max(...segmentDegrees(steps))

			// Allowing a hair over: a segment is split into a whole number of frames, so the last one
			// lands on or under the target rather than exactly at it.
			expect(worst).toBeLessThanOrEqual(DEFAULT_DEGREES_PER_FRAME + 0.001)
		}
	)

	it('turns the free-space teleport into a sweep', () => {
		expect(plans.freeSpace).toHaveLength(2)
		expect(interpolatedFrames(plans.freeSpace).steps.length).toBeGreaterThan(150)
	})

	it('leaves an already-dense plan essentially alone', () => {
		// Frames added, not a fraction of the plan's length: 6 of its 224 segments exceed the budget
		// and contribute all 11, so a `× 1.1` bound would read as slack it does not have.
		const { steps } = interpolatedFrames(plans.linear)
		expect(steps.length - plans.linear.length).toBe(11)
	})

	it('spends frames where the motion is, not where the waypoints are', () => {
		const planned = plans.obstacle
		const { waypoints } = interpolatedFrames(planned)

		const segments = segmentDegrees(planned).map((degrees, index) => ({
			degrees,
			frames: waypoints[index + 1]! - waypoints[index]!,
		}))

		const longest = segments.toSorted((a, b) => b.degrees - a.degrees)[0]!
		const zeroLength = segments.find((segment) => segment.degrees === 0)!

		expect(longest.frames).toBeGreaterThan(40)
		expect(zeroLength.frames).toBe(1)
	})

	it('coarsens rather than truncates when the frame cap binds', () => {
		const { steps, waypoints, coarsening } = interpolatedFrames(plans.linear, { degrees: 0.0001 })

		expect(coarsening).toBeGreaterThan(1)
		// The cap bounds interpolation; each planned waypoint keeps its own frame regardless, so the
		// ceiling is the budget plus the plan's own length.
		expect(steps.length).toBeLessThanOrEqual(MAX_INTERPOLATED_FRAMES + plans.linear.length)
		expect(steps.at(-1)).toEqual(plans.linear.at(-1))
		expect(waypoints).toHaveLength(plans.linear.length)
	})

	// The cap-binding case above asserts how many waypoints there are and never where they point.
	it('still points each waypoint at its own frame when the cap binds', () => {
		const { steps, waypoints, coarsening } = interpolatedFrames(plans.linear, { degrees: 0.0001 })

		expect(coarsening).toBeGreaterThan(1)
		for (const [index, frame] of waypoints.entries()) {
			expect(steps[frame]).toBe(plans.linear[index])
		}
	})

	// Nothing else here pins `coarsening` to a number, only to 1, so a scaled or offset value would
	// be wrong on every plan with every other assertion green.
	it('reports a coarsening of exactly 1 when the budget is met', () => {
		expect(interpolatedFrames(plans.linear).coarsening).toBe(1)
		expect(interpolatedFrames(plans.freeSpace).coarsening).toBe(1)
	})

	it('reports coarsening as the factor the cap stretched each frame by', () => {
		const budget = { degrees: 0.0001 }
		const total = plans.linear
			.slice(1)
			.reduce((sum, step, index) => sum + segmentFrameCost(plans.linear[index]!, step, budget), 0)

		expect(interpolatedFrames(plans.linear, budget).coarsening).toBeCloseTo(
			total / MAX_INTERPOLATED_FRAMES,
			6
		)
	})

	it.each([
		['an empty plan', []],
		['a single-step plan', [{ arm: [0] }]],
	])('returns %s unchanged', (_label, planned) => {
		expect(interpolatedFrames(planned).steps).toBe(planned)
	})
})

/**
 * `plan-gantry.json` is a 40 mm slide with the arm held still. Costed in radians it comes to 1,529
 * frames, and a longer stroke alongside real arm motion collapses every arm segment to one frame.
 */
describe('a plan with a prismatic joint in it', () => {
	/**
	 * Exact, not a band: a band wide enough to read as sane accepts a millimetre budget anywhere from
	 * 2 to 20. Ten and not nine because the stroke is `90.00000000000001 - 50`, which `Math.ceil`
	 * rounds up.
	 */
	it('spends exactly the budgeted frames on a 40 mm slide', () => {
		const { steps } = interpolatedFrames(plans.gantry, { motions: GANTRY_MOTIONS })

		expect(steps).toHaveLength(10)
	})

	// The stroke and the arm motion in separate segments, which is where the damage is: read as
	// radians, 500 mm is 28,648°, enough on its own to blow the frame cap and coarsen what follows.
	it('lets the arm keep its own resolution when a long stroke shares the plan', () => {
		const together: TrajectoryStep[] = [
			{ 'arm-1': [0], 'gantry-1': [0] },
			{ 'arm-1': [0], 'gantry-1': [500] },
			{ 'arm-1': [(12 * Math.PI) / 180], 'gantry-1': [500] },
		]

		const { steps, waypoints } = interpolatedFrames(together, { motions: GANTRY_MOTIONS })
		// `segmentDegrees` is unit-blind by design, so read the arm's column on its own.
		const armDegrees = segmentDegrees(steps.map((step) => ({ 'arm-1': step['arm-1']! })))

		expect(waypoints[2]! - waypoints[1]!).toBeGreaterThan(1)
		expect(Math.max(...armDegrees)).toBeLessThanOrEqual(DEFAULT_DEGREES_PER_FRAME + 0.001)
	})

	it('reads an unlabelled joint as revolute', () => {
		const unlabelled = interpolatedFrames(plans.gantry)
		const labelled = interpolatedFrames(plans.gantry, { motions: GANTRY_MOTIONS })

		expect(unlabelled.steps.length).toBeGreaterThan(labelled.steps.length)
	})
})

describe('segmentFrameCost', () => {
	it('costs a revolute joint by the degree budget', () => {
		const cost = segmentFrameCost({ arm: [0] }, { arm: [Math.PI / 2] }, { degrees: 1.5 })
		expect(cost).toBeCloseTo(60)
	})

	it('costs a prismatic joint by the millimetre budget', () => {
		const motions: JointMotions = new Map([['gantry', ['translational'] as const]])
		const cost = segmentFrameCost({ gantry: [0] }, { gantry: [40] }, { millimetres: 5, motions })

		expect(cost).toBeCloseTo(8)
	})

	it('takes the costliest joint, so the two units never add up', () => {
		const motions: JointMotions = new Map([['gantry', ['translational'] as const]])
		const cost = segmentFrameCost(
			{ arm: [0], gantry: [0] },
			{ arm: [Math.PI / 2], gantry: [40] },
			{ degrees: 1.5, millimetres: 5, motions }
		)

		expect(cost).toBeCloseTo(60)
	})

	// Every other prismatic assertion here passes `millimetres: 5`, which is the default, so ignoring
	// the option entirely would look correct.
	it('reads the millimetre budget rather than always defaulting it', () => {
		const motions: JointMotions = new Map([['gantry', ['translational'] as const]])
		const cost = segmentFrameCost({ gantry: [0] }, { gantry: [40] }, { millimetres: 20, motions })

		expect(cost).toBeCloseTo(2)
	})

	it('costs a segment that moves nothing at zero', () => {
		expect(segmentFrameCost({ arm: [1, 2] }, { arm: [1, 2] })).toBe(0)
	})

	it.each([
		['zero', 0],
		['negative', -1.5],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
	])('falls back to the default for a %s degree budget', (_label, degrees) => {
		const from = { arm: [0] }
		const to = { arm: [Math.PI / 2] }

		expect(segmentFrameCost(from, to, { degrees })).toBe(segmentFrameCost(from, to))
	})

	it.each([
		['zero', 0],
		['NaN', Number.NaN],
	])('falls back to the default for a %s millimetre budget', (_label, millimetres) => {
		const motions: JointMotions = new Map([['gantry', ['translational'] as const]])
		const from = { gantry: [0] }
		const to = { gantry: [40] }

		expect(segmentFrameCost(from, to, { millimetres, motions })).toBe(
			segmentFrameCost(from, to, { motions })
		)
	})

	it('still fills in a free-space plan when handed a zero budget', () => {
		expect(interpolatedFrames(plans.freeSpace, { degrees: 0 }).steps.length).toBeGreaterThan(150)
	})
})

// `constructor` and `__proto__` are legal RDK resource names. Only `lerpTrajectoryStep` is hurt; the
// cost functions' joint guard absorbs a prototype value.
describe('a component named like an Object.prototype member', () => {
	const proto = (json: string) => JSON.parse(json) as TrajectoryStep

	it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
		'costs a segment that drops %s without reading the prototype',
		(name) => {
			const from = proto(`{"arm": [0], ${JSON.stringify(name)}: []}`)
			const to = proto('{"arm": [1]}')

			expect(segmentFrameCost(from, to)).toBeCloseTo((1 * RAD_TO_DEG) / DEFAULT_DEGREES_PER_FRAME)
			expect(largestJointDelta(from, to)).toBeCloseTo(1)
		}
	)

	it.each(['constructor', 'toString', 'hasOwnProperty'])('blends a plan containing %s', (name) => {
		const from = proto(`{"arm": [0], ${JSON.stringify(name)}: []}`)
		const to = proto('{"arm": [1]}')

		const blended = lerpTrajectoryStep(from, to, 0.5)
		expect(blended.arm).toEqual([0.5])
		expect(blended[name]).toEqual([])
	})

	it('keeps a component named __proto__ as a key rather than a setter', () => {
		const blended = lerpTrajectoryStep(
			proto('{"__proto__": [0]}'),
			proto('{"__proto__": [2]}'),
			0.5
		)

		expect(Object.keys(blended)).toEqual(['__proto__'])
		expect(blended['__proto__']).toEqual([1])
	})

	it('interpolates a plan containing one end to end', () => {
		const planned = [proto('{"arm": [0], "constructor": []}'), proto('{"arm": [1]}')]
		expect(interpolatedFrames(planned).steps.length).toBeGreaterThan(30)
	})
})

describe('jointMotionsOf', () => {
	const joint = (
		componentName: string,
		jointIndex: number,
		motion: JointMotion,
		mimic?: { multiplier: number; offset: number }
	): FrameDescriptor => ({
		kind: 'joint',
		motion,
		name: `${componentName}:joint-${jointIndex}`,
		parent: 'world',
		axis: { X: 0, Y: 0, Z: 1 },
		componentName,
		jointIndex,
		mimic,
		uuid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
	})

	it('indexes each joint the way a trajectory step does', () => {
		const motions = jointMotionsOf([
			joint('gantry', 0, 'translational'),
			joint('arm', 1, 'rotational'),
		])

		expect(motions.get('gantry')).toEqual(['translational'])
		expect(motions.get('arm')?.[1]).toBe('rotational')
	})

	// The tests around this one use a single joint per component, which leaves the accumulation
	// untested: rebuilding the array rather than reading it back keeps only the last axis.
	it('keeps every joint of a component, not just the last', () => {
		const motions = jointMotionsOf([
			joint('gantry', 0, 'translational'),
			joint('gantry', 1, 'translational'),
			joint('gantry', 2, 'translational'),
		])

		expect(motions.get('gantry')).toEqual(['translational', 'translational', 'translational'])
	})

	it('ignores frames that are not joints', () => {
		const motions = jointMotionsOf([
			{
				kind: 'static',
				name: 'table',
				parent: 'world',
				localPose: new Pose(),
				geometry: null,
				uuid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
			},
			joint('arm', 0, 'rotational'),
		])

		expect([...motions.keys()]).toEqual(['arm'])
	})

	// Both orders, because the winner is decided by frame-system key order: pinning only the order
	// that happens to fail leaves half of it green.
	it.each([
		[
			'source first',
			[
				joint('gantry', 0, 'translational'),
				joint('gantry', 0, 'rotational', { multiplier: 1, offset: 0 }),
			],
		],
		[
			'mimic first',
			[
				joint('gantry', 0, 'rotational', { multiplier: 1, offset: 0 }),
				joint('gantry', 0, 'translational'),
			],
		],
	] as const)('lets the column owner win over a mimic of it, %s', (_label, descriptors) => {
		expect(jointMotionsOf([...descriptors]).get('gantry')).toEqual(['translational'])
	})

	// 60 anchors the whole-plan consequence: the same slide costed in degrees is 1,529 frames.
	it('spends a sane number of frames on a slide whose column is mimicked by a revolute joint', () => {
		const motions = jointMotionsOf([
			joint('gantry-1', 0, 'translational'),
			joint('gantry-1', 0, 'rotational', { multiplier: 1, offset: 0 }),
		])

		expect(interpolatedFrames(plans.gantry, { motions }).steps.length).toBeLessThan(60)
	})
})
