import type { JsonValue } from '@bufbuild/protobuf'

import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/math'

import { parseMoveOptions } from '../parseMoveOptions'
import {
	executeCommand,
	isAlreadyAtGoal,
	parsePlanResult,
	planCommand,
	PlanCommandError,
	type TrajectoryStep,
} from '../planDoCommand'

// Distinct orientation components, so a transposed `oX`/`oY` cannot pass unnoticed.
const goal = new Pose(100, -200, 350).merge({ oX: 0.6, oY: -0.8, oZ: 1, theta: 45 })

/**
 * The message's own field shape with no prototype, which is what the SDK's `WorldState` type means:
 * it aliases to `PlainMessage`. A spread keeps the fields, including the `{case, value}` oneofs.
 */
const asPlainMessage = <T extends object>(message: T): T => ({ ...message })

const request = (overrides: Partial<Parameters<typeof planCommand>[0]> = {}) =>
	planCommand({
		service: 'builtin',
		componentName: 'left-arm',
		destination: { referenceFrame: 'world', pose: goal },
		...overrides,
	})

/** RDK `protojson.Unmarshal`s the command's value, so the payload is a JSON *string*. */
const moveRequestOf = (command: Record<string, JsonValue>) =>
	JSON.parse(command.plan as string) as Record<string, JsonValue>

describe('planCommand', () => {
	it('addresses the motion service and the frame being moved', () => {
		const moveRequest = moveRequestOf(request())
		expect(moveRequest.name).toBe('builtin')
		expect(moveRequest.componentName).toBe('left-arm')
	})

	it('serializes the destination with protojson field names and units', () => {
		expect(moveRequestOf(request()).destination).toEqual({
			referenceFrame: 'world',
			pose: { x: 100, y: -200, z: 350, oX: 0.6, oY: -0.8, oZ: 1, theta: 45 },
		})
	})

	it('sends exactly the fields `MoveRequest` declares and no others', () => {
		expect(Object.keys(moveRequestOf(request())).toSorted()).toEqual([
			'componentName',
			'destination',
			'name',
		])
	})

	it.each(['x', 'theta'])('refuses a goal whose %s is not finite', (field) => {
		const broken = goal.clone().merge({ [field]: Number.NaN })

		expect(() => request({ destination: { referenceFrame: 'world', pose: broken } })).toThrow(
			PlanCommandError
		)
	})

	it("omits world state and constraints when the panel's fields are empty", () => {
		const moveRequest = moveRequestOf(request(parseMoveOptions('', '')))
		expect(moveRequest.worldState).toBeUndefined()
		expect(moveRequest.constraints).toBeUndefined()
	})

	it('passes through the same world state and constraints `move` would receive', () => {
		const options = parseMoveOptions(
			'{"obstacles":[{"referenceFrame":"world","geometries":[{"sphere":{"radiusMm":50}}]}]}',
			'{"linearConstraint":[{"lineToleranceMm":5}]}'
		)

		const moveRequest = moveRequestOf(request(options))
		expect(moveRequest.worldState).toEqual({
			obstacles: [{ referenceFrame: 'world', geometries: [{ sphere: { radiusMm: 50 } }] }],
		})
		expect(moveRequest.constraints).toEqual({ linearConstraint: [{ lineToleranceMm: 5 }] })
	})

	/**
	 * `parseMoveOptions` returns real message instances, for which the rebuild is a no-op, so with
	 * only that input deleting the rebuild passes every other test here.
	 */
	it('accepts the plain-message shape its signature actually describes', () => {
		const options = parseMoveOptions(
			'{"obstacles":[{"referenceFrame":"world","geometries":[{"sphere":{"radiusMm":50}}]}]}',
			'{"linearConstraint":[{"lineToleranceMm":5}]}'
		)

		const moveRequest = moveRequestOf(
			request({
				worldState: options.worldState && asPlainMessage(options.worldState),
				constraints: options.constraints && asPlainMessage(options.constraints),
			})
		)

		// A geometry's shape is a oneof, the part a careless rebuild drops, leaving an obstacle with no
		// volume and a preview that plans straight through it.
		expect(moveRequest.worldState).toEqual({
			obstacles: [{ referenceFrame: 'world', geometries: [{ sphere: { radiusMm: 50 } }] }],
		})
		expect(moveRequest.constraints).toEqual({ linearConstraint: [{ lineToleranceMm: 5 }] })
	})
})

describe('executeCommand', () => {
	const trajectory: TrajectoryStep[] = [{ 'left-arm': [0, 0.5] }, { 'left-arm': [0.1, 0.4] }]

	// Against a literal, not against `trajectory` itself: the command holds the same array reference,
	// so comparing it to its own source is a tautology any in-place reordering would survive.
	it('sends the trajectory back verbatim', () => {
		expect(executeCommand(trajectory).execute).toEqual([
			{ 'left-arm': [0, 0.5] },
			{ 'left-arm': [0.1, 0.4] },
		])
	})

	it('arms the start-state check RDK will not run unasked', () => {
		expect(executeCommand(trajectory)).toHaveProperty('executeCheckStart')
	})

	it('defers the tolerance to RDK rather than naming one', () => {
		expect(executeCommand(trajectory).executeCheckStart).toBeLessThanOrEqual(0)
	})
})

describe('parsePlanResult', () => {
	it("reads the trajectory RDK returns under the command's own key", () => {
		const { trajectory } = parsePlanResult({
			plan: [{ 'left-arm': [0, 0.5], 'left-gripper': [] }],
		})

		expect(trajectory).toEqual([{ 'left-arm': [0, 0.5], 'left-gripper': [] }])
	})

	/**
	 * Each row asserts its own message. A bare `toThrow(PlanCommandError)` cannot tell a non-array
	 * plan from a null step, so they could drift into sharing one message that fits only one cause.
	 */
	it.each([
		['a non-object reply', 'nope' as JsonValue, /unexpected plan response/],
		['a reply with no plan key', { execute: true } as JsonValue, /no trajectory/],
		['a null plan, which is how a Go nil marshals', { plan: null } as JsonValue, /no trajectory/],
		['a plan that is not an array', { plan: { arm: [0] } } as JsonValue, /not a list of steps/],
		[
			'joint values that are not numbers',
			{ plan: [{ arm: ['0'] }] } as JsonValue,
			/non-numeric joint value/,
		],
		['a null step', { plan: [{ arm: [0] }, null] } as JsonValue, /null trajectory step/],
		['a null joint value', { plan: [{ arm: [0, null] }] } as JsonValue, /null joint value/],
		['an empty trajectory', { plan: [] } as JsonValue, /empty trajectory/],
	])('rejects %s', (_label, value, message) => {
		expect(() => parsePlanResult(value)).toThrow(PlanCommandError)
		expect(() => parsePlanResult(value)).toThrow(message)
	})

	/**
	 * `{}` and `[]` share a message: both name zero components, and that is the whole of what is wrong
	 * with either. A non-empty array step is a different defect, a list where a map was expected.
	 */
	it.each([
		['a step with no columns', { plan: [{ arm: [0] }, {}] } as JsonValue, /naming no components/],
		[
			'a step that is an array',
			{
				plan: [
					[
						[0, 1],
						[2, 3],
					],
				],
			} as JsonValue,
			/unnamed joint values/,
		],
		['nothing but empty steps', { plan: [[], []] } as JsonValue, /naming no components/],
	])('rejects %s rather than reading it as the zero configuration', (_label, value, message) => {
		expect(() => parsePlanResult(value)).toThrow(message)
	})

	it.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY],
	])('rejects a trajectory carrying %s rather than sampling the whole plan away', (_label, bad) => {
		const value = { plan: [{ arm: [0, 0] }, { arm: [0.5, bad] }] } as unknown as JsonValue

		expect(() => parsePlanResult(value)).toThrow(PlanCommandError)
		expect(() => parsePlanResult(value)).toThrow(/non-finite joint value/)
	})

	it('tells an unreadable trajectory apart from an absent one', () => {
		const old = { plan: [{ arm: [{ Value: 0.1 }] }] } as JsonValue

		expect(() => parsePlanResult(old)).toThrow(/older joint-value format/)
		expect(() => parsePlanResult({ execute: true })).not.toThrow(/older joint-value format/)
	})
})

describe('isAlreadyAtGoal', () => {
	it('recognizes the start configuration returned twice', () => {
		expect(isAlreadyAtGoal([{ arm: [0, 1.5] }, { arm: [0, 1.5] }])).toBe(true)
	})

	/**
	 * With only single-component steps `every` and `some` behave identically, so "all components held
	 * still" versus "any one of them did" goes untested. RDK pads zero-DoF frames with `[]`.
	 */
	it('recognizes a full multi-component step, padding and all', () => {
		const step: TrajectoryStep = {
			'arm-1': [0, 0, 0, 0, 0, 0],
			'arm-1_origin': [],
			'gantry-1': [50],
			'gantry-1_origin': [],
		}

		expect(isAlreadyAtGoal([step, { ...step }])).toBe(true)
	})

	it('is false when one component moves and the rest are held', () => {
		const held = { 'arm-1_origin': [], 'gantry-1': [50], 'gantry-1_origin': [] }

		expect(
			isAlreadyAtGoal([
				{ 'arm-1': [0, 0, 0], ...held },
				{ 'arm-1': [0.4, 0, 0], ...held },
			])
		).toBe(false)
	})

	it.each<[string, TrajectoryStep[]]>([
		['a real move', [{ arm: [0] }, { arm: [1] }]],
		['a single step', [{ arm: [0] }]],
		['nothing at all', []],
		['different components', [{ arm: [0] }, { gantry: [0] }]],
		['a component only one step has', [{ arm: [0] }, { arm: [0], gripper: [1] }]],
		['different joint counts', [{ arm: [0] }, { arm: [0, 0] }]],
		// A plain `b[name]` lookup reads through to `Object.prototype`, where `toString.length` is 0
		// and matches an empty column, so two steps naming different components compared equal.
		['a component sharing a name with an Object member', [{ toString: [] }, { arm: [] }]],
	])('is false for %s', (_label, trajectory) => {
		expect(isAlreadyAtGoal(trajectory)).toBe(false)
	})

	/**
	 * The second case pins the length check itself: destructuring reads indices 0 and 1, so a plan
	 * whose first two steps differ stays false even if the length test is loosened.
	 */
	it.each<[string, TrajectoryStep[]]>([
		['ending where it started', [{ arm: [0] }, { arm: [1] }, { arm: [0] }]],
		['repeating its seed before moving', [{ arm: [0] }, { arm: [0] }, { arm: [1] }]],
	])('is false for a longer plan %s', (_label, trajectory) => {
		expect(isAlreadyAtGoal(trajectory)).toBe(false)
	})
})
