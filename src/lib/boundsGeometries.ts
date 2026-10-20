import {
	BOUNDS_FACES,
	type BoundsFace,
	type BoundsHint,
	type ObstacleGeometryConfig,
} from '$lib/obstacleAttributes'

/** Negates without producing `-0`, which a stored config would round-trip as `0`. */
const negate = (value: number): number => (value === 0 ? 0 : -value)

const buildWall = (
	face: BoundsFace,
	{ x_mm: x, y_mm: y, z_mm: z, wall_thickness_mm: t }: BoundsHint
): ObstacleGeometryConfig => {
	const wall = (
		translation: [number, number, number],
		dims: [number, number, number]
	): ObstacleGeometryConfig => ({
		label: face,
		type: 'box',
		x: dims[0],
		y: dims[1],
		z: dims[2],
		translation: { x: translation[0], y: translation[1], z: translation[2] },
	})

	switch (face) {
		case 'x_max': {
			return wall([x / 2 + t / 2, 0, 0], [t, y + 2 * t, z + 2 * t])
		}
		case 'x_min': {
			return wall([negate(x / 2 + t / 2), 0, 0], [t, y + 2 * t, z + 2 * t])
		}
		case 'y_max': {
			return wall([0, y / 2 + t / 2, 0], [x + 2 * t, t, z + 2 * t])
		}
		case 'y_min': {
			return wall([0, negate(y / 2 + t / 2), 0], [x + 2 * t, t, z + 2 * t])
		}
		case 'floor': {
			return wall([0, 0, negate(z / 2 + t / 2)], [x + 2 * t, y + 2 * t, t])
		}
		case 'ceiling': {
			return wall([0, 0, z / 2 + t / 2], [x + 2 * t, y + 2 * t, t])
		}
		default: {
			const unreachable: never = face
			throw new Error(`Unknown bounds face: ${String(unreachable)}`)
		}
	}
}

/**
 * One box geometry per included wall of a Bounds obstacle, labeled by face and positioned
 * around an interior centered on the component frame. Walls overlap at the edges so the
 * shell is closed.
 */
export const generateBoundsGeometries = (hint: BoundsHint): ObstacleGeometryConfig[] =>
	BOUNDS_FACES.filter((face) => !hint.exclude.includes(face)).map((face) => buildWall(face, hint))
