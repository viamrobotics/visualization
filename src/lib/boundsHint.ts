import { generateBoundsGeometries } from '$lib/boundsGeometries'
import {
	BOUNDS_FACES,
	type BoundsFace,
	type BoundsHint,
	explicitGeometryLabel,
	type ObstacleGeometryConfig,
} from '$lib/obstacleAttributes'

/** How far apart two wall values may be and still match, in mm. Absorbs float noise from recovery. */
const WALL_TOLERANCE_MM = 1e-6

/** Decimal places a recovered hint value keeps, matching {@link WALL_TOLERANCE_MM}. */
const RECOVERED_DECIMALS = 6

type Axis = 'x' | 'y' | 'z'

const AXES: readonly Axis[] = ['x', 'y', 'z']

/** The axis each wall is thin along, and offset along. */
const WALL_AXIS: Record<BoundsFace, Axis> = {
	x_max: 'x',
	x_min: 'x',
	y_max: 'y',
	y_min: 'y',
	floor: 'z',
	ceiling: 'z',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

// Typed for `unknown` lookups: the hint comes from config JSON, so membership is the check itself.
const BOUNDS_FACE_SET: ReadonlySet<unknown> = new Set(BOUNDS_FACES)

const isBoundsFace = (value: unknown): value is BoundsFace => BOUNDS_FACE_SET.has(value)

const isPositiveFinite = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0

/** Structural equality that ignores object key order and float noise, but respects array order. */
const matches = (left: unknown, right: unknown): boolean => {
	if (typeof left === 'number' && typeof right === 'number') {
		return Math.abs(left - right) <= WALL_TOLERANCE_MM
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((item, index) => matches(item, right[index]))
		)
	}

	if (isRecord(left) && isRecord(right)) {
		const leftKeys = Object.keys(left)
		return (
			leftKeys.length === Object.keys(right).length &&
			leftKeys.every((key) => key in right && matches(left[key], right[key]))
		)
	}

	return Object.is(left, right)
}

/** `value` as a Bounds hint, or undefined unless it is one with a positive interior and walls. */
export const parseBoundsHint = (value: unknown): BoundsHint | undefined => {
	if (!isRecord(value) || value.type !== 'bounds') return undefined

	const { x_mm, y_mm, z_mm, wall_thickness_mm, exclude } = value
	if (
		!isPositiveFinite(x_mm) ||
		!isPositiveFinite(y_mm) ||
		!isPositiveFinite(z_mm) ||
		!isPositiveFinite(wall_thickness_mm) ||
		!Array.isArray(exclude) ||
		!exclude.every((face) => isBoundsFace(face))
	) {
		return undefined
	}

	return { type: 'bounds', x_mm, y_mm, z_mm, wall_thickness_mm, exclude }
}

/**
 * Whether `geometries` are exactly the walls `hint` generates, matched by label so their order
 * does not matter. A moved or resized wall does not match.
 */
export const boundsWallsMatch = (
	hint: BoundsHint,
	geometries: ObstacleGeometryConfig[]
): boolean => {
	const stored = new Map(geometries.map((geometry) => [explicitGeometryLabel(geometry), geometry]))
	const expected = generateBoundsGeometries(hint)

	return (
		stored.size === geometries.length &&
		expected.length === geometries.length &&
		expected.every((wall) => matches(wall, stored.get(wall.label ?? '')))
	)
}

const recovered = (value: number): number => Number(value.toFixed(RECOVERED_DECIMALS))

/**
 * The Bounds hint `geometries` were generated from, for an obstacle stored without one. Any one
 * wall gives the whole interior: its thin side is the wall thickness, its other two sides span
 * the interior plus two walls, and its offset is half the interior plus half a wall.
 */
export const boundsHintFromWalls = (
	geometries: ObstacleGeometryConfig[]
): BoundsHint | undefined => {
	const [wall] = geometries
	if (wall?.type !== 'box') return undefined

	const face = explicitGeometryLabel(wall)
	if (!isBoundsFace(face)) return undefined

	const thinAxis = WALL_AXIS[face]
	const thickness = wall[thinAxis]
	const interior = Object.fromEntries(
		AXES.map((axis) => [
			axis,
			axis === thinAxis
				? 2 * Math.abs(wall.translation?.[axis] ?? 0) - thickness
				: wall[axis] - 2 * thickness,
		])
	) as Record<Axis, number>

	const present = new Set(geometries.map((geometry) => explicitGeometryLabel(geometry)))
	const hint = parseBoundsHint({
		type: 'bounds',
		x_mm: recovered(interior.x),
		y_mm: recovered(interior.y),
		z_mm: recovered(interior.z),
		wall_thickness_mm: recovered(thickness),
		exclude: BOUNDS_FACES.filter((candidate) => !present.has(candidate)),
	})

	return hint && boundsWallsMatch(hint, geometries) ? hint : undefined
}
