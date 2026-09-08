/**
 * A point in 3-space, expressed as a plain tuple rather than a `Vector3` so this module
 * stays pure: no Three.js instance identity, no ECS, easy to hand literal values to.
 */
export type Point3 = readonly [number, number, number]

/** Below this ray length, treat the ray as a point rather than a direction. */
const EPSILON = 1e-9

const subtract = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

const length = (v: Point3) => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The interior angle in degrees at `vertex`, between the ray to `a` and the ray to `b`.
 *
 * Degenerate cases are decided explicitly rather than left to fall out of the trig, so a
 * `NaN` never reaches a label:
 * - Either ray has (near) zero length — `a` or `b` coincides with `vertex`, so no direction
 *   exists to measure an angle between. Returns `0` rather than dividing by zero.
 * - The rays are exactly collinear pointing the same way — returns `0`.
 * - The rays are exactly collinear pointing opposite ways, i.e. `vertex` sits on the segment
 *   between `a` and `b` — returns `180`.
 */
export const interiorAngle = (a: Point3, vertex: Point3, b: Point3): number => {
	const rayA = subtract(a, vertex)
	const rayB = subtract(b, vertex)
	const lengthA = length(rayA)
	const lengthB = length(rayB)

	if (lengthA < EPSILON || lengthB < EPSILON) return 0

	const cosine = dot(rayA, rayB) / (lengthA * lengthB)
	const clamped = Math.min(1, Math.max(-1, cosine))

	return (Math.acos(clamped) * 180) / Math.PI
}
