import type { Entity } from 'koota'

import { Matrix4, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

const tempPose = new Pose()
const centerMatrix = new Matrix4()
const baseMatrix = new Matrix4()
const partMatrix = new Matrix4()
const scale = new Vector3()
const boundsSize = new Vector3()

const MM_TO_M = 0.001

/**
 * Compose a capsule entity's three render transforms into the supplied
 * matrices: the cylinder `body` plus the two hemisphere caps `headTop` (+Z) and
 * `headBottom` (−Z). Each is `WorldMatrix × Center pose × part`, the same
 * composition the former per-entity path produced by nesting scaled/positioned
 * meshes inside a `WorldMatrix`-driven group.
 *
 * Viam's capsule `l` is the *total* length including the rounded caps, so the
 * cylinder spans `l − 2r` and each cap centre sits `±(l − 2r)/2` from the
 * origin. When `l ≤ 2r` the capsule is a sphere: the body collapses to zero
 * height (the caller hides it) and the two caps meet at the centre.
 *
 * Returns `false` (leaving the matrices untouched) when the entity is missing
 * the traits needed to place a capsule.
 */
export const composeCapsuleMatrices = (
	entity: Entity,
	body: Matrix4,
	headTop: Matrix4,
	headBottom: Matrix4
): boolean => {
	const capsule = entity.get(traits.Capsule)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!capsule || !worldMatrix) {
		return false
	}

	baseMatrix.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		baseMatrix.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	const r = capsule.r * MM_TO_M
	const midsection = Math.max(0, capsule.l * MM_TO_M - 2 * r)
	const halfMid = midsection / 2

	// Body: the open-ended unit cylinder scaled to radius `r` and the midsection
	// length, centred on the capsule origin.
	partMatrix.makeScale(r, r, midsection)
	body.multiplyMatrices(baseMatrix, partMatrix)

	// +Z cap: the unit hemisphere (rounded toward +Z) pushed out by `halfMid`.
	partMatrix.makeScale(r, r, r)
	partMatrix.setPosition(0, 0, halfMid)
	headTop.multiplyMatrices(baseMatrix, partMatrix)

	// −Z cap: flip the hemisphere about X so it rounds toward −Z, then push it
	// out the other way.
	partMatrix.makeRotationX(Math.PI)
	partMatrix.scale(scale.setScalar(r))
	partMatrix.setPosition(0, 0, -halfMid)
	headBottom.multiplyMatrices(baseMatrix, partMatrix)

	return true
}

/**
 * Compose a capsule's selection-bounds transform into `out`:
 * `WorldMatrix × Center pose × (2r, 2r, l)` in meters. The capsule's local AABB
 * is ±r radially and ±l/2 axially, so scaling the `OBBHelper`'s unit box (±0.5)
 * by these extents wraps the whole capsule. This mirrors how `composeBoxMatrix`
 * doubles as both a box's render and its selection-bounds transform — capsules
 * render as several instanced parts, so the single bounds matrix lives here
 * instead.
 *
 * The axial extent is clamped to `max(l, 2r)`: when `l ≤ 2r` the capsule
 * renders as a sphere of radius `r`, so its bounds are `2r` on every axis.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a capsule.
 */
export const composeCapsuleBoundsMatrix = (entity: Entity, out: Matrix4): boolean => {
	const capsule = entity.get(traits.Capsule)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!capsule || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	const diameter = 2 * capsule.r * MM_TO_M
	const length = Math.max(capsule.l, 2 * capsule.r) * MM_TO_M
	out.scale(boundsSize.set(diameter, diameter, length))

	return true
}
