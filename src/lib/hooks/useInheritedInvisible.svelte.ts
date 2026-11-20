import { type Entity, type World } from 'koota'

import { ChildOf } from '#lib/ecs/relations.js'
import { InheritedInvisible, Invisible } from '#lib/ecs/traits.js'
import { useWorld } from '#lib/ecs/useWorld.js'

/**
 * Walks up `ChildOf` and returns true if the entity itself or any
 * ancestor has `Invisible`. Memoizes via `cache` so siblings in the
 * same flush reuse a parent's result.
 */
const hasInherited = (entity: Entity, cache: Map<Entity, boolean>): boolean => {
	const cached = cache.get(entity)
	if (cached !== undefined) return cached
	if (!entity.isAlive()) return false

	if (entity.has(Invisible)) {
		cache.set(entity, true)
		return true
	}

	const parent = entity.targetFor(ChildOf)
	const inherited = parent && parent.isAlive() ? hasInherited(parent, cache) : false
	cache.set(entity, inherited)
	return inherited
}

const flushDirty = (world: World, dirty: Set<Entity>) => {
	if (dirty.size === 0) return

	const cache = new Map<Entity, boolean>()
	const allEntities = new Set<Entity>()

	const collectChildren = (entity: Entity) => {
		if (allEntities.has(entity)) return
		allEntities.add(entity)
		for (const child of world.query(ChildOf(entity))) {
			collectChildren(child)
		}
	}

	for (const entity of dirty) {
		collectChildren(entity)
	}

	dirty.clear()

	for (const entity of allEntities) {
		if (!entity.isAlive()) {
			continue
		}

		const hasInheritedTrait = hasInherited(entity, cache)
		const hasTrait = entity.has(InheritedInvisible)

		if (hasInheritedTrait && !hasTrait) {
			entity.add(InheritedInvisible)
		} else if (!hasInheritedTrait && hasTrait) {
			entity.remove(InheritedInvisible)
		}
	}
}

export const addInheritedInvisibleListeners = (world: World) => {
	const dirty = new Set<Entity>()
	let scheduled = false

	const enqueue = (entity: Entity) => {
		dirty.add(entity)
		if (scheduled) return
		scheduled = true

		// Microtask-deferred so a burst of changes is grouped into one subtree walk.
		queueMicrotask(() => {
			scheduled = false
			flushDirty(world, dirty)
		})
	}

	for (const entity of world.query(Invisible)) {
		enqueue(entity)
	}

	const unsubs = [
		world.onAdd(Invisible, enqueue),
		world.onRemove(Invisible, enqueue),
		world.onAdd(ChildOf, enqueue),
		world.onChange(ChildOf, enqueue),
		world.onRemove(ChildOf, enqueue),
	]

	return () => {
		for (const unsub of unsubs) {
			unsub()
		}
	}
}

export const provideInheritedInvisible = (): void => {
	const world = useWorld()

	$effect(() => addInheritedInvisibleListeners(world))
}
