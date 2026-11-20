import type { SimBody } from './sim-scene'

/**
 * The names of bodies a joint can move: those with a joint, and everything below one. Expects
 * `bodies` parents first, as `SimScene.bodies` is.
 */
export const movingBodies = (bodies: readonly SimBody[]): Set<string> => {
	const moving = new Set<string>()
	for (const body of bodies) {
		const isParentMoving = body.parent !== undefined && moving.has(body.parent)
		if (body.joint || isParentMoving) moving.add(body.name)
	}
	return moving
}
