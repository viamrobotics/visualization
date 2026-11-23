import type { Entity } from 'koota'

import { selectOnly, traits, useWorld } from '#lib/ecs/index.js'

/**
 * Selects the entities for a set of component names once all of them exist. Writing a component to
 * the config spawns its entity only after `useFrames` reconciles it, so a selection made at write
 * time would find nothing.
 *
 * @returns Call with the names to wait for, before writing the config. A later call replaces the
 *   names still pending.
 */
export const useSelectOnArrival = (): ((names: Iterable<string>) => void) => {
	const world = useWorld()

	let pending = new Set<string>()
	let arrived: Entity[] = []

	$effect(() => {
		return world.onAdd(traits.Name, (entity) => {
			const name = entity.get(traits.Name)
			if (name === undefined || !pending.delete(name)) return

			arrived.push(entity)
			if (pending.size > 0) return

			selectOnly(world, ...arrived)
			arrived = []
		})
	})

	return (names) => {
		pending = new Set(names)
		arrived = []
	}
}
