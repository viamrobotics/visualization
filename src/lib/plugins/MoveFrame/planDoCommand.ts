import type { JsonValue } from '@bufbuild/protobuf'

import { Constraints, WorldState } from '@viamrobotics/sdk'

import type { Pose } from '$lib/math'
import type { TrajectoryStep } from '$lib/motion/jointPose'

export interface PlanResult {
	trajectory: TrajectoryStep[]
}

export interface PlanRequest {
	/** The motion service's own resource name, `MoveRequest.name`. */
	service: string
	/** The frame being moved, `MoveRequest.component_name`. */
	componentName: string
	/** Where it should end up, and the frame that pose is expressed in. */
	destination: { referenceFrame: string; pose: Pose }
	worldState?: WorldState
	constraints?: Constraints
}

/**
 * The builtin motion service's `plan` verb, absent from the motion proto and so from any generated
 * client.
 *
 * RDK `protojson.Unmarshal`s the string, so the payload uses protojson field names
 * (`componentName`, `oX`/`oY`/`oZ`) and the message's own units: millimeters, `theta` in degrees.
 */
export const planCommand = ({
	service,
	componentName,
	destination,
	worldState,
	constraints,
}: PlanRequest): Record<string, JsonValue> => {
	// `JSON.stringify` writes `null` for a non-finite number, and Go's protojson skips a null scalar
	// rather than rejecting it, so a `NaN` goal would reach RDK as 0 mm and plan a move nobody asked
	// for.
	if (!destination.pose.isFinite()) {
		throw new PlanCommandError('The move target is not a finite pose.')
	}

	const moveRequest: Record<string, JsonValue> = {
		name: service,
		componentName,
		destination: {
			referenceFrame: destination.referenceFrame,
			pose: {
				x: destination.pose.x,
				y: destination.pose.y,
				z: destination.pose.z,
				oX: destination.pose.oX,
				oY: destination.pose.oY,
				oZ: destination.pose.oZ,
				theta: destination.pose.theta,
			},
		},
	}

	// The SDK exports each of these as both a class and a `PlainMessage` alias, and it is the alias
	// that lands in a type position, so what arrives here has no `toJson`. Rebuilding is what reaches
	// protojson.
	if (worldState) moveRequest.worldState = new WorldState(worldState).toJson()
	if (constraints) moveRequest.constraints = new Constraints(constraints).toJson()

	return { plan: JSON.stringify(moveRequest) }
}

/**
 * Selects RDK's own `defaultExecuteEpsilon`: `builtin.go` reads any value at or below zero as "use
 * the default". How far an arm may drift before its plan is stale is a property of the arm.
 */
const RDK_DEFAULT_EPSILON = 0

/**
 * The service's other `DoCommand` verb, absent from the motion proto for the same reason as `plan`.
 * Runs a trajectory verbatim.
 *
 * Builds the `execute` command. `executeCheckStart`'s presence is the switch (`builtin.go`); omit it
 * and epsilon is `math.MaxFloat64`, so the trajectory runs from wherever the components happen to be.
 */
export const executeCommand = (trajectory: TrajectoryStep[]): Record<string, JsonValue> => ({
	execute: trajectory,
	executeCheckStart: RDK_DEFAULT_EPSILON,
})

/**
 * `every` says yes to two degenerate shapes by default: an array is `typeof 'object'`, and
 * `Object.values({})` is vacuously fine. Finite, not merely numeric, since `typeof NaN === 'number'`.
 */
const isTrajectoryStep = (step: unknown): step is TrajectoryStep =>
	typeof step === 'object' &&
	step !== null &&
	!Array.isArray(step) &&
	Object.keys(step).length > 0 &&
	Object.values(step as Record<string, unknown>).every(
		(inputs) => Array.isArray(inputs) && inputs.every((input) => Number.isFinite(input))
	)

const isTrajectory = (value: unknown): value is TrajectoryStep[] =>
	Array.isArray(value) && value.every((step) => isTrajectoryStep(step))

/**
 * RDK older than ~v0.101 serialized `Input` as the struct `{Value: number}` rather than the float
 * alias it is today, so a plan that succeeded comes back looking like this. Given its own message.
 */
const isOldInputShape = (inputs: unknown): boolean =>
	Array.isArray(inputs) &&
	inputs.some((input) => typeof input === 'object' && input !== null && 'Value' in input)

const hasOldInputShape = (trajectory: unknown): boolean =>
	Array.isArray(trajectory) &&
	trajectory.some(
		(step) =>
			typeof step === 'object' &&
			step !== null &&
			!Array.isArray(step) &&
			Object.values(step as Record<string, unknown>).some((value) => isOldInputShape(value))
	)

/**
 * Diagnoses a trajectory that already failed {@link isTrajectory}. Each structurally different way a
 * reply can be malformed gets its own message rather than one that guesses at an RDK version.
 */
const describeMalformedTrajectory = (value: unknown): string => {
	if (!Array.isArray(value)) {
		return 'Motion service returned a trajectory that is not a list of steps.'
	}

	for (const step of value) {
		if (Array.isArray(step)) {
			return step.length === 0
				? 'Motion service returned a trajectory step naming no components.'
				: 'Motion service returned a trajectory step with unnamed joint values.'
		}

		if (step === null || typeof step !== 'object') {
			return 'Motion service returned a null trajectory step.'
		}

		const columns = Object.entries(step)
		if (columns.length === 0) {
			return 'Motion service returned a trajectory step naming no components.'
		}

		for (const [name, inputs] of columns) {
			if (!Array.isArray(inputs)) {
				return `Motion service returned a non-list joint value for component "${name}".`
			}
			for (const input of inputs) {
				if (input === null) {
					return `Motion service returned a null joint value for component "${name}".`
				}
				if (typeof input !== 'number') {
					return `Motion service returned a non-numeric joint value for component "${name}".`
				}
				if (!Number.isFinite(input)) {
					return `Motion service returned a non-finite joint value for component "${name}".`
				}
			}
		}
	}

	// Unreachable from `parsePlanResult`: every caller already knows `isTrajectory` returned false,
	// and the walk above covers every way `isTrajectoryStep` can say no to a step.
	return 'Motion service returned a trajectory this client cannot read.'
}

export class PlanCommandError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'PlanCommandError'
	}
}

/**
 * Reads a `plan` reply. Throws rather than returning an empty trajectory: a silent empty result
 * would render as "planned successfully, nothing to show".
 */
export const parsePlanResult = (value: JsonValue): PlanResult => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new PlanCommandError('Motion service returned an unexpected plan response.')
	}

	const trajectory = (value as Record<string, JsonValue>).plan

	// `== null` rather than `=== undefined`: a Go nil trajectory marshals to JSON `null`, which is
	// nothing to draw for the same reason an absent key is.
	if (trajectory == null) {
		throw new PlanCommandError('Motion service returned no trajectory for this move.')
	}

	// Checked ahead of `isTrajectory` so this one explainable shape gets its own message. There is no
	// version RPC to probe with, so the reply's shape is the only evidence available.
	if (hasOldInputShape(trajectory)) {
		throw new PlanCommandError(
			'Motion service returned a trajectory using an older joint-value format. The machine may be running an older version of RDK.'
		)
	}

	if (!isTrajectory(trajectory)) {
		throw new PlanCommandError(describeMalformedTrajectory(trajectory))
	}

	if (trajectory.length === 0) {
		throw new PlanCommandError('Motion service returned an empty trajectory.')
	}

	return { trajectory }
}

const sameInputs = (firstStep: TrajectoryStep, secondStep: TrajectoryStep): boolean => {
	const names = Object.keys(firstStep)
	if (names.length !== Object.keys(secondStep).length) return false

	return names.every((name) => {
		// `hasOwn` rather than testing `secondStep[name]`: a plain index reads through to
		// `Object.prototype`, so a component named `toString` matched a member function whose
		// `length` happens to be 0.
		if (!Object.hasOwn(secondStep, name)) return false

		const left = firstStep[name]
		const right = secondStep[name]
		return (
			left !== undefined &&
			right !== undefined &&
			left.length === right.length &&
			left.every((value, index) => value === right[index])
		)
	})
}

/**
 * RDK seeds its trajectory with the start configuration, so a satisfied goal returns two
 * bit-identical steps, never empty. Length two matters: a longer plan ending where it began is a
 * real move.
 */
export const isAlreadyAtGoal = (trajectory: TrajectoryStep[]): boolean => {
	if (trajectory.length !== 2) return false

	const [first, last] = trajectory
	return first !== undefined && last !== undefined && sameInputs(first, last)
}

export { type TrajectoryStep } from '$lib/motion/jointPose'
