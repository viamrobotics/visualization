import type { Entity } from 'koota'

import { ChildOf } from './relations'
import * as traits from './traits'

/**
 * The entity a click on `hit` selects: the obstacle an `ObstacleShape` belongs to, since a shape
 * cannot be moved on its own, and `hit` itself for anything else.
 */
export const clickSelectionTarget = (hit: Entity): Entity => {
	if (!hit.has(traits.ObstacleShape)) return hit
	return hit.targetFor(ChildOf) ?? hit
}
