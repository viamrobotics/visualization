import { Matrix4, Quaternion, Vector3 } from 'three'

import type { ArrowAxis, PlaneAxis } from './gizmos'

const scratchQuaternion = new Quaternion()
const scratchDirection = new Vector3()
const unitScale = new Vector3(1, 1, 1)
const xAxis = new Vector3(1, 0, 0)
const yAxis = new Vector3(0, 1, 0)
const zAxis = new Vector3(0, 0, 1)

/**
 * Transform placing an arrow gizmo at `position`, oriented so its local +Y tail points away
 * from `axis`'s world direction, or from `surfaceNormal` when `axis` is `'surface'`.
 */
export const arrowMatrix = (
	axis: ArrowAxis,
	position: Vector3,
	surfaceNormal: Vector3 | undefined
): Matrix4 => {
	let direction: Vector3
	if (axis === 'surface') direction = surfaceNormal ?? zAxis
	else if (axis === 'x') direction = xAxis
	else if (axis === 'z') direction = zAxis
	else direction = yAxis

	scratchDirection.copy(direction).negate()
	scratchQuaternion.setFromUnitVectors(yAxis, scratchDirection)

	return new Matrix4().compose(position, scratchQuaternion, unitScale)
}

/** Transform placing a reference-plane gizmo at `position`, rotated to lie in world plane `axis`. */
export const planeMatrix = (axis: PlaneAxis, position: Vector3): Matrix4 => {
	if (axis === 'yz') scratchQuaternion.setFromAxisAngle(yAxis, Math.PI / 2)
	else if (axis === 'xz') scratchQuaternion.setFromAxisAngle(xAxis, -Math.PI / 2)
	else scratchQuaternion.identity()

	return new Matrix4().compose(position, scratchQuaternion, unitScale)
}
