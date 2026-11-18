export const MIN_PATH_STEPS = 2
export const MAX_PATH_STEPS = 200
export const DEFAULT_PATH_STEPS = 25

/** A uniform step is treated as already being the last-good keyframe within this fraction. */
const SPLICE_EPSILON = 1e-4

export interface PathStep {
	configuration: Record<string, number[]>
	/** Position along the start → end segment, 0 to 1. */
	fraction: number
	isLastGood: boolean
}

const lerp = (from: number, to: number, fraction: number): number => from + (to - from) * fraction

/**
 * Component arrays are unioned rather than intersected: the request's `start_state.configuration`
 * lists every component (most with empty arrays) while `last_good_inputs` carries only the arm, and
 * either side may be the shorter one.
 */
const lerpConfiguration = (
	from: Record<string, number[]>,
	to: Record<string, number[]>,
	fraction: number
): Record<string, number[]> => {
	const configuration: Record<string, number[]> = {}

	for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
		const a = from[key] ?? []
		const b = to[key] ?? []
		const length = Math.max(a.length, b.length)
		const values: number[] = []

		for (let index = 0; index < length; index += 1) {
			values.push(lerp(a[index] ?? b[index] ?? 0, b[index] ?? a[index] ?? 0, fraction))
		}

		configuration[key] = values
	}

	return configuration
}

/**
 * Recovers where along the segment the path check stopped accepting.
 *
 * RDK derives `last_good_inputs` by walking the straight joint-space line, so every joint yields the
 * same fraction. Reading it off the joint that travels furthest keeps the division away from a
 * near-zero denominator.
 */
const lastGoodFraction = (
	from: Record<string, number[]>,
	to: Record<string, number[]>,
	lastGood: Record<string, number[]>
): number | null => {
	let widestDelta = 0
	let fraction: number | null = null

	for (const [key, values] of Object.entries(lastGood)) {
		const a = from[key]
		const b = to[key]
		if (!a || !b) continue

		for (const [index, value] of values.entries()) {
			const start = a[index]
			const end = b[index]
			if (start === undefined || end === undefined) continue

			const delta = Math.abs(end - start)
			if (delta <= widestDelta) continue

			widestDelta = delta
			fraction = (value - start) / (end - start)
		}
	}

	if (fraction === null || !Number.isFinite(fraction)) return null

	return Math.min(1, Math.max(0, fraction))
}

/**
 * Samples the straight joint-space line from `start` to `end` — the same path RDK's check-path
 * walks, which is why a failing candidate's collision shows up on it.
 *
 * `lastGood` is spliced in at its true fraction rather than left to land between samples. These
 * paths fail in the first few percent of travel, so a uniform sampling steps clean over the
 * boundary and the one configuration worth landing on becomes unreachable.
 */
export const buildInterpolatedPath = (
	start: Record<string, number[]>,
	end: Record<string, number[]>,
	steps: number,
	lastGood?: Record<string, number[]>
): PathStep[] => {
	const count = Math.min(MAX_PATH_STEPS, Math.max(MIN_PATH_STEPS, Math.trunc(steps)))
	const path: PathStep[] = []

	for (let index = 0; index < count; index += 1) {
		const fraction = index / (count - 1)
		path.push({
			configuration: lerpConfiguration(start, end, fraction),
			fraction,
			isLastGood: false,
		})
	}

	const fraction = lastGood ? lastGoodFraction(start, end, lastGood) : null
	if (fraction === null) return path

	const coincident = path.find((step) => Math.abs(step.fraction - fraction) < SPLICE_EPSILON)
	if (coincident) {
		coincident.isLastGood = true
		return path
	}

	path.push({
		// Interpolation supplies the components `last_good_inputs` omits; its own values, being the
		// exact ones RDK accepted, win where it has them.
		configuration: { ...lerpConfiguration(start, end, fraction), ...lastGood },
		fraction,
		isLastGood: true,
	})

	return path.toSorted((a, b) => a.fraction - b.fraction)
}
