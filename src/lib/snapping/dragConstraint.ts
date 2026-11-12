import { type Quaternion, Vector3 } from 'three'

/**
 * The directions a translate drag may move in: anywhere, along one axis, or within one plane.
 * Directions are unit vectors in world space.
 */
export type DragConstraint =
	| { kind: 'free' }
	| { kind: 'axis'; direction: Vector3 }
	| { kind: 'plane'; normal: Vector3 }

const AXIS_LETTERS = ['X', 'Y', 'Z'] as const

const AXIS_VECTORS = {
	X: new Vector3(1, 0, 0),
	Y: new Vector3(0, 1, 0),
	Z: new Vector3(0, 0, 1),
} as const

/**
 * The constraint behind a `TransformControls` translate handle.
 *
 * @param axis The handle being dragged, as `TransformControls.axis` names it: `'X'`, `'XY'`, `'XYZ'`.
 * @param orientation The gizmo's orientation at drag start, used when `space` is `'local'`.
 */
export const dragConstraintFor = (
	axis: string,
	space: 'local' | 'world',
	orientation: Quaternion
): DragConstraint => {
	const present = AXIS_LETTERS.filter((letter) => axis.includes(letter))
	const missing = AXIS_LETTERS.filter((letter) => !axis.includes(letter))
	const orient = (vector: Vector3) =>
		space === 'local' ? vector.applyQuaternion(orientation) : vector

	const [only] = present
	if (present.length === 1 && only) {
		return { kind: 'axis', direction: orient(AXIS_VECTORS[only].clone()) }
	}

	const [planeNormal] = missing
	if (missing.length === 1 && planeNormal) {
		return { kind: 'plane', normal: orient(AXIS_VECTORS[planeNormal].clone()) }
	}

	// The centre handle moves in the camera plane, in world space, whatever `space` says.
	return { kind: 'free' }
}

/** Drops the part of `delta` the constraint forbids, in place. */
export const constrainDelta = (delta: Vector3, constraint: DragConstraint): Vector3 => {
	switch (constraint.kind) {
		case 'free': {
			return delta
		}
		case 'axis': {
			return delta.projectOnVector(constraint.direction)
		}
		case 'plane': {
			return delta.projectOnPlane(constraint.normal)
		}
		default: {
			return constraint satisfies never
		}
	}
}
