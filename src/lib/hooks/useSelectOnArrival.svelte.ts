import type { Entity } from 'koota'

import { selectOnly, traits, useWorld } from '#lib/ecs/index.js'

interface PendingSelection {
	/**
	 * Selects the entities for `names` once every one of them exists. Call it before writing the
	 * config. A later call replaces the names still pending.
	 */
	select: (names: Iterable<string>) => void
	/** Stops waiting, for a write that did not land. */
	cancel: () => void
}

/**
 * Selects the entities a config write is about to create. Writing a component to the config
 * spawns its entity only after `useFrames` reconciles it, so a selection made at write time would
 * find nothing. Selecting anything else before they all arrive gives up the wait.
 */
export const useSelectOnArrival = (): PendingSelection => {
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

	// Selecting something else while waiting means the user moved on, so a late arrival must not
	// take the selection from them. This hook's own selection lands only once nothing is pending.
	$effect(() => {
		return world.onAdd(traits.Selected, () => {
			pending = new Set()
			arrived = []
		})
	})

	return {
		select: (names) => {
			pending = new Set(names)
			arrived = []
		},
		cancel: () => {
			pending = new Set()
			arrived = []
		},
	}
}
