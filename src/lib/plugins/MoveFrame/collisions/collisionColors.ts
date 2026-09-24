import type { Entity } from 'koota'

import { Color } from 'three'

import { traits } from '$lib/ecs'

import { COLLISION_COLOR } from './collisionColor'

interface RGB {
	r: number
	g: number
	b: number
}

/**
 * Read back through `Color.setRGB`, which does no colour-space conversion, so
 * the channels are stored in the working space `new Color(hex)` produces — the
 * same round-trip the move ghosts rely on.
 */
const red = new Color(COLLISION_COLOR)
const collisionRGB: RGB = { r: red.r, g: red.g, b: red.b }

/**
 * The colours displaced by the red, keyed by entity. A `undefined` value means
 * the entity carried no `Color` trait before, and should get none back.
 */
export type ColorStash = Map<Entity, RGB | undefined>

export const createColorStash = (): ColorStash => new Map()

const paint = (entity: Entity) => {
	if (entity.has(traits.Color)) entity.set(traits.Color, collisionRGB)
	else entity.add(traits.Color(collisionRGB))
}

const restore = (entity: Entity, previous: RGB | undefined) => {
	if (!entity.isAlive()) return
	if (previous) entity.set(traits.Color, previous)
	else entity.remove(traits.Color)
}

/**
 * Paint everything in `colliding` red and put back whatever the entities that
 * left the set were wearing.
 *
 * Writing `traits.Color` rather than adding a marker trait means the instanced
 * renderers need no changes at all: they already re-read appearance on
 * `onChange(Color)`. The cost is this bookkeeping, and the requirement that
 * exactly one caller owns the stash — two writers would stash each other's red
 * and never restore the original.
 *
 * Entities carrying per-vertex `Colors` are unaffected: `resolveColor` in the
 * renderers checks those first, so they never take the red. `GetGeometries`
 * primitives don't carry them, so in practice this only spares dropped meshes.
 */
export const syncCollisionColors = (colliding: ReadonlySet<Entity>, stash: ColorStash): void => {
	for (const entity of colliding) {
		if (stash.has(entity) || !entity.isAlive()) continue
		const current = entity.get(traits.Color)
		stash.set(entity, current ? { r: current.r, g: current.g, b: current.b } : undefined)
		paint(entity)
	}

	for (const [entity, previous] of stash) {
		if (colliding.has(entity)) continue
		restore(entity, previous)
		stash.delete(entity)
	}
}

/** Put every displaced colour back. For teardown, when the last panel closes. */
export const clearCollisionColors = (stash: ColorStash): void => {
	for (const [entity, previous] of stash) restore(entity, previous)
	stash.clear()
}
