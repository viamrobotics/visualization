import type { PlainMessage } from '@bufbuild/protobuf'

import { Quaternion, Vector3 } from 'three'

import type { Pose } from '$lib/buf/common/v1/common_pb'

import { OrientationVector } from '$lib/math/OrientationVector'

/** The axis a CAD tool treats as up. Viam's frames are Z-up. */
export type UpAxis = 'x' | 'y' | 'z'

/**
 * The origin orientation, as an orientation vector in degrees, that turns a mesh authored with
 * `up` as its up axis into Viam's Z-up frame. `'z'` is the identity.
 */
export const upAxisOrientation = (
	up: UpAxis
): Pick<PlainMessage<Pose>, 'oX' | 'oY' | 'oZ' | 'theta'> => {
	const quaternion = new Quaternion()
	if (up === 'y') quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
	else if (up === 'x') quaternion.setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2)
	else return { oX: 0, oY: 0, oZ: 1, theta: 0 }

	const ov = new OrientationVector().setFromQuaternion(quaternion).setUnits('degrees')
	return { oX: clean(ov.x), oY: clean(ov.y), oZ: clean(ov.z), theta: clean(ov.th) }
}

/** Rounds away floating-point residue so a quarter turn reads as 0, 1 or 90. */
const clean = (value: number): number => {
	const rounded = Math.round(value * 1e9) / 1e9
	return rounded === 0 ? 0 : rounded
}
