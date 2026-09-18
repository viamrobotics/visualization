import type { Entity } from 'koota'

import { type Intersection, type Object3D, Vector3 } from 'three'

/**
 * Whether `hit` should be treated as the surface the user is pointing at: nothing in its
 * `Object3D` ancestry is invisible, and it does not fall inside `ignoreEntity`'s own subtree.
 */
export const isUsableHit = (hit: Intersection, ignoreEntity?: Entity): boolean => {
	if (ignoreEntity !== undefined && isInEntitySubtree(hit.object, ignoreEntity)) return false
	return isVisibleInTree(hit.object)
}

/** The world-space point of the first usable hit, or `undefined` if none is usable. */
export const cursorPoint = (
	intersections: Intersection[],
	ignoreEntity?: Entity
): Vector3 | undefined => {
	const hit = intersections.find((intersection) => isUsableHit(intersection, ignoreEntity))
	return hit?.point.clone()
}

/** The world-space position and surface normal of the first usable hit. */
export const cursorHit = (
	intersections: Intersection[],
	ignoreEntity?: Entity
): { position: Vector3; normal: Vector3 } | undefined => {
	const hit = intersections.find((intersection) => isUsableHit(intersection, ignoreEntity))
	if (!hit) return undefined

	const position = hit.point.clone()
	const normal = hit.face
		? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
		: new Vector3(0, 0, 1)

	return { position, normal }
}

const isVisibleInTree = (object: Object3D): boolean => {
	let current: Object3D | null = object
	while (current) {
		if (!current.visible) return false
		current = current.parent
	}

	return true
}

// Entity renderers stamp the Koota entity id into Object3D.name, so ancestry walks can
// compare it directly. Three types name as a string, but it holds the numeric entity id.
const isInEntitySubtree = (object: Object3D, entity: Entity): boolean => {
	let current: Object3D | null = object
	while (current) {
		if ((current.name as unknown as Entity) === entity) return true
		current = current.parent
	}

	return false
}
