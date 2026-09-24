import { type ConfigurableTrait, type Entity, type World } from 'koota'

import { ChildOf } from './relations'
import * as traits from './traits'

/**
 * Trait list for `world.spawn(...)`. Always emits `Orphan(name)` for non-root
 * parents; the hierarchy resolver (`provideHierarchy`) swaps it to
 * `ChildOf(parentEntity)` once a frame with that name exists. Returns `[]`
 * for the world root (`undefined`, `''`, or `'world'`).
 */
export const parentTraits = (name: string | undefined): ConfigurableTrait[] => {
	if (!name || name === 'world') return []
	return [traits.Orphan(name)]
}

/**
 * Set or clear an entity's parent. Strips any existing `ChildOf` or `Orphan`,
 * then writes `Orphan(name)` (the resolver converts it to `ChildOf` on the
 * next reactive flush). Pass `undefined` or `'world'` to detach to root.
 *
 * Short-circuits when the effective parent name (via resolved `ChildOf` or
 * pending `Orphan`) already matches `name`. Network-backed reconcilers call
 * this every refetch tick on stable entities; the demote-then-re-resolve
 * dance otherwise flips `useParentName` to `undefined` and back, remounting
 * every `<Portal id={parent.current}>` subtree per tick.
 */
export const setParent = (entity: Entity, name: string | undefined): void => {
	const desired = !name || name === 'world' ? undefined : name
	const target = entity.targetFor(ChildOf)
	const current =
		(target?.isAlive() ? target.get(traits.Name) : undefined) ?? entity.get(traits.Orphan)
	if (current === desired) return

	if (target) entity.remove(ChildOf(target))
	entity.remove(traits.Orphan)

	if (desired === undefined) return
	entity.add(traits.Orphan(desired))
}

/** The parent entity, or `undefined` at the world root or while orphaned. */
export const getParentEntity = (entity: Entity): Entity | undefined => entity.targetFor(ChildOf)

/**
 * The parent's name string. Reads through `ChildOf` first, falls back to
 * `Orphan(name)` while the parent isn't present. Returns `undefined` for
 * world-root entities.
 */
export const getParentName = (entity: Entity): string | undefined => {
	const parent = entity.targetFor(ChildOf)
	if (parent && parent.isAlive()) {
		return parent.get(traits.Name)
	}
	const orphanFor = entity.get(traits.Orphan)
	return orphanFor || undefined
}

/**
 * Destroy an entity and every `ChildOf` descendant, depth-first. Use for
 * sub-trees whose lifetimes are tied together (e.g. a model root and its
 * GLTF assets). General frame removal should use `entity.destroy()` so
 * children survive as orphans.
 */
export const destroyEntityTree = (world: World, entity: Entity): void => {
	if (!entity.isAlive()) return
	for (const child of world.query(ChildOf(entity))) {
		destroyEntityTree(world, child)
	}
	entity.destroy()
}

/**
 * Synchronously resolve every `Orphan` whose desired parent now exists in
 * the world. Called by `provideHierarchy` when the orphan/named query sets
 * change or when a `Name` is renamed; also exposed for tests so they can
 * drive resolution without mounting a component.
 *
 * The first loop builds a `name → entity` map. The second loop reads each
 * orphan's wanted parent name from that map and attaches `ChildOf` to the
 * entity it found.
 *
 * Two checks prevent an entity from being parented to itself (a `ChildOf`
 * cycle would loop `recomputeWorldMatrix` forever):
 *
 *   1. When two entities have the same `Name`, the map keeps whichever
 *      one does NOT have `Orphan`. An entity that still has `Orphan` is
 *      one we're still trying to resolve — it could be the same entity
 *      the second loop looks up. Letting it fill the slot would make the
 *      lookup return the orphan itself.
 *   2. In the second loop, if the lookup returns the orphan itself, skip
 *      it. This catches the case where the orphan is the only entity in
 *      the world with that `Name`.
 */
export const resolveOrphans = (named: readonly Entity[], orphans: readonly Entity[]): void => {
	const index = new Map<string, Entity>()
	for (const entity of named) {
		const name = entity.get(traits.Name)
		if (!name) continue

		const existing = index.get(name)
		if (existing && !existing.has(traits.Orphan)) {
			continue
		}

		index.set(name, entity)
	}

	for (const orphan of orphans) {
		const wantedName = orphan.get(traits.Orphan)
		if (!wantedName) continue

		const parent = index.get(wantedName)
		if (!parent || parent === orphan) continue

		orphan.remove(traits.Orphan)
		orphan.add(ChildOf(parent))
	}
}
