import type { Quaternion, Vector3 } from 'three'

/** A geometry the scale gizmo can size, in mm. */
export type ScalableGeometry =
	| { type: 'box'; x: number; y: number; z: number }
	| { type: 'sphere'; r: number }
	| { type: 'capsule'; r: number; l: number }

/** Which scale handles the gizmo shows for a selection. */
export interface ScaleHandles {
	showY: boolean
	showZ: boolean
	/** The x handle alone scales every dimension of every geometry by its factor. */
	isUniform: boolean
}

/** Smallest angle, in radians, between two orientations that still share scale axes. */
const AXIS_ALIGNMENT_TOLERANCE = 1e-4

/**
 * The scale handles a selection supports. Three.js always scales along the gizmo's own
 * axes, which follow the first selected geometry. A handle per axis is offered only when
 * every geometry is the same kind and lines up with the first, so an axis means the same
 * dimension on each. Otherwise only a uniform handle is offered.
 *
 * @param geometries The selected geometries, first selected first. Never empty.
 * @param orientations Each geometry's world orientation, in the same order.
 */
export const scaleHandles = (
	geometries: readonly ScalableGeometry[],
	orientations: readonly Quaternion[]
): ScaleHandles => {
	const [first] = geometries
	const [firstOrientation] = orientations
	const isOneKind = geometries.every((geometry) => geometry.type === first?.type)
	const isAligned =
		!!firstOrientation &&
		orientations.every(
			(orientation) => orientation.angleTo(firstOrientation) <= AXIS_ALIGNMENT_TOLERANCE
		)

	if (!first || !isOneKind || !isAligned) return { showY: false, showZ: false, isUniform: true }
	if (first.type === 'sphere') return { showY: false, showZ: false, isUniform: true }
	if (first.type === 'capsule') return { showY: true, showZ: false, isUniform: false }
	return { showY: true, showZ: true, isUniform: false }
}

/**
 * The geometry `start` becomes under the gizmo's scale `factor`, clamped at 0. The gizmo
 * reports a negative factor when dragged past its origin, which would give a negative size.
 */
export const scaledGeometry = (
	start: ScalableGeometry,
	factor: Vector3,
	isUniform: boolean
): ScalableGeometry => {
	const scale = (value: number, axisFactor: number) =>
		Math.max(0, value * (isUniform ? factor.x : axisFactor))

	switch (start.type) {
		case 'box': {
			return {
				type: 'box',
				x: scale(start.x, factor.x),
				y: scale(start.y, factor.y),
				z: scale(start.z, factor.z),
			}
		}
		case 'sphere': {
			return { type: 'sphere', r: scale(start.r, factor.x) }
		}
		case 'capsule': {
			return { type: 'capsule', r: scale(start.r, factor.x), l: scale(start.l, factor.y) }
		}
		default: {
			const unreachable: never = start
			return unreachable
		}
	}
}
