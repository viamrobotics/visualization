/**
 * A hand conversion of `spatialmath/orientation_json.go`, so the switch below
 * can fall behind its original without failing. Separate from `./spatialJson`,
 * which re-exports it, because `Pose` needs it.
 */

import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

import { OrientationVector } from './OrientationVector'

/** Straight off the wire: `type` is any string RDK wrote, `value` whatever shape matches it. */
export type RawOrientation = { type?: string; value?: unknown }

const tmpE = new Euler()
const tmpAxis = new Vector3()
const tmpOv = new OrientationVector()

/**
 * Either spelling: RDK marshals untagged Go fields as `{ W, X, Y, Z }`, the
 * frame editor writes `{ w, x, y, z }`, and Go's unmarshal accepts both.
 */
type QuatJson = Partial<Record<'W' | 'X' | 'Y' | 'Z' | 'w' | 'x' | 'y' | 'z', number>>
type EulerJson = Partial<Record<'roll' | 'pitch' | 'yaw', number>>
type OvJson = { x: number; y: number; z: number; th: number }

/**
 * Writes `out` and reports whether it holds a real rotation; false leaves it identity. Callers that
 * only apply a rotation when one exists ask by calling — the switch below is the single list of
 * encodings this file handles, so there is nothing to keep in step with it.
 *
 * Identity is correct for an absent or empty-string orientation (RDK's own zero value) and wrong for
 * a `type` with no case here, which is why only the latter warns: it renders confidently wrong
 * rather than visibly missing. Guessing a default encoding would be worse than either, because
 * `axis_angles` and both orientation-vector types share the same `{ x, y, z, th }` field names — a
 * mis-tagged value still decodes to a plausible rotation.
 */
export const quatFromJson = (orientation: RawOrientation | undefined, out: Quaternion): boolean => {
	const value = orientation?.value
	if (value) {
		switch (orientation?.type) {
			case 'quaternion': {
				const v = value as QuatJson
				// RDK writes the scalar first; Three.js takes it last. Omitted fields
				// default to Go's zero and the result is normalized, as
				// `quaternionJSON.toQuaternion` does.
				out.set(v.X ?? v.x ?? 0, v.Y ?? v.y ?? 0, v.Z ?? v.z ?? 0, v.W ?? v.w ?? 0).normalize()
				return true
			}
			case 'euler_angles': {
				const v = value as EulerJson
				// Note: if it's at all possible for the input here to be a json with omitted values
				// this will break, because it will set the elements to NaNs.
				// Probably better to guard against this, but if we know for sure that
				// RawOrientation is always defined, it's not needed

				out.setFromEuler(tmpE.set(v.roll ?? 0, v.pitch ?? 0, v.yaw ?? 0, 'ZYX'))
				return true
			}
			case 'ov_radians': {
				const v = value as OvJson
				tmpOv.set(v.x, v.y, v.z, v.th).toQuaternion(out)
				return true
			}
			case 'ov_degrees': {
				const v = value as OvJson
				tmpOv.set(v.x, v.y, v.z, MathUtils.degToRad(v.th ?? 0)).toQuaternion(out)
				return true
			}
			// R4AA tags its fields th/x/y/z, so it arrives shaped like an orientation vector.
			case 'axis_angles': {
				const v = value as OvJson
				// RDK normalizes inside `R4AA.ToQuat`, and `setFromAxisAngle` assumes a
				// unit axis. RDK panics on a zero one rather than defining it.
				tmpAxis.set(v.x, v.y, v.z)
				if (tmpAxis.lengthSq() > 0) {
					out.setFromAxisAngle(tmpAxis.normalize(), v.th ?? 0)
					return true
				}
				console.warn('[spatialJson] axis_angles has a zero axis — using identity')
				out.set(0, 0, 0, 1)
				return false
			}
		}
	}

	if (orientation?.type) {
		console.warn(`[spatialJson] unhandled orientation "${orientation.type}" — using identity`)
	}
	out.set(0, 0, 0, 1)
	return false
}
