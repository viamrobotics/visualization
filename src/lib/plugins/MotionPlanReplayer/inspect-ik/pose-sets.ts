import type { IKCandidate } from './ik-candidates'

export type PoseKind = 'start' | 'lastGood' | 'end' | 'path'

export interface PoseStyle {
	/** Scene colour, 0-1 floats. Three.js materials can't read Tailwind tokens. */
	rgb: { r: number; g: number; b: number }
	opacity: number
	/** The same role as a DOM class, kept alongside the scene colour so the two can't drift. */
	swatchClass: string
}

export interface PoseSet {
	kind: PoseKind
	/** Frame-name namespace, and the name of the set's root entity. */
	prefix: string
	label: string
	configuration: Record<string, number[]>
	style: PoseStyle
}

const START: PoseStyle = {
	rgb: { r: 0.29, g: 0.47, b: 0.7 },
	opacity: 0.3,
	swatchClass: 'bg-info-dark',
}

const LAST_GOOD: PoseStyle = {
	rgb: { r: 0.95, g: 0.66, b: 0.15 },
	opacity: 0.5,
	swatchClass: 'bg-warning-dark',
}

const END_VALID: PoseStyle = {
	rgb: { r: 0.13, g: 0.65, b: 0.35 },
	opacity: 0.6,
	swatchClass: 'bg-success-dark',
}

const END_FAILED: PoseStyle = {
	rgb: { r: 0.85, g: 0.25, b: 0.25 },
	opacity: 0.6,
	swatchClass: 'bg-danger-dark',
}

/**
 * Neutral rather than another traffic-light colour: this is the arm at wherever the scrubber
 * currently sits, read against the coloured reference poses rather than classified alongside them.
 */
export const PATH_STYLE: PoseStyle = {
	rgb: { r: 0.16, g: 0.17, b: 0.19 },
	opacity: 0.9,
	swatchClass: 'bg-dark',
}

/** Deliberately desaturated: obstacles are the fixed world, not one of the candidate poses. */
export const OBSTACLE_STYLE: PoseStyle = {
	rgb: { r: 0.45, g: 0.45, b: 0.48 },
	opacity: 0.35,
	swatchClass: 'bg-medium',
}

export const PREFIX: Record<PoseKind, string> = {
	start: 'ik-start',
	lastGood: 'ik-last-good',
	end: 'ik-end',
	path: 'ik-path',
}

/**
 * A red candidate's end pose is itself in collision, so interpolating towards it only animates the
 * arm into a goal already known to be unreachable — the failure is the goal, not the route.
 */
export const supportsInterpolation = (
	candidate: IKCandidate,
	startConfiguration: Record<string, number[]>
): boolean =>
	candidate.status !== 'invalid' &&
	candidate.solution.configuration !== null &&
	Object.keys(startConfiguration).length > 0

/**
 * Which poses a candidate is worth drawing. A green candidate only needs start and end; a yellow
 * one also needs the last configuration the path check accepted, which is where the useful
 * information is — the end pose itself was fine.
 */
export const poseSetsForCandidate = (
	candidate: IKCandidate,
	startConfiguration: Record<string, number[]>
): PoseSet[] => {
	const { solution, status } = candidate
	const sets: PoseSet[] = []

	// An empty start configuration would draw an all-zeros arm that reads as a real pose. Leaving
	// the set out is honest about not knowing where the arm started.
	if (Object.keys(startConfiguration).length > 0) {
		sets.push({
			kind: 'start',
			prefix: PREFIX.start,
			label: 'Start',
			configuration: startConfiguration,
			style: START,
		})
	}

	// A seed the solver returned nothing for has no pose to show — only the start. 35 of the 130
	// demo candidates are like this, all of them `cost: -1` with no error.
	if (!solution.configuration) return sets

	if (status === 'path-invalid' && solution.lastGoodInputs) {
		sets.push({
			kind: 'lastGood',
			prefix: PREFIX.lastGood,
			label: 'Last good',
			configuration: solution.lastGoodInputs,
			style: LAST_GOOD,
		})
	}

	// Only a red candidate's end pose actually collides. A yellow one reached a valid configuration
	// and failed on the way there, so drawing its end pose as a failure would point the user at the
	// goal when the goal is fine.
	const endFailed = status === 'invalid'

	sets.push({
		kind: 'end',
		prefix: PREFIX.end,
		label: endFailed ? 'Failing pose' : 'End',
		configuration: solution.configuration,
		style: endFailed ? END_FAILED : END_VALID,
	})

	return sets
}
