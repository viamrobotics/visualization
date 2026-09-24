import { type Entity, trait } from 'koota'
import { untrack } from 'svelte'

import { relations, traits, useQuery, useWorld } from '$lib/ecs'

const HiddenByIsolate = trait()

export const provideIsolate = (isolating: () => boolean) => {
	const world = useWorld()
	const selected = useQuery(traits.Selected)

	$effect(() => {
		if (!isolating()) {
			for (const entity of world.query(HiddenByIsolate)) {
				entity.remove(HiddenByIsolate, traits.Invisible)
			}

			return
		}

		// Snapshot the selection untracked so `isolating()` is this effect's only dependency. Selecting or deselecting while isolated must not change what is hidden.
		const selectedEntities = untrack(() => selected.current)

		// Entities render only while `InheritedInvisible` is unset, and that trait cascades down `ChildOf` (see `useInheritedInvisible`). Keep each selection's ancestors and descendants visible.
		const keep = new Set<Entity>()

		const keepSubtree = (entity: Entity) => {
			if (keep.has(entity)) return
			keep.add(entity)
			for (const child of world.query(relations.ChildOf(entity))) {
				keepSubtree(child)
			}
		}

		for (const entity of selectedEntities) {
			let ancestor = entity.targetFor(relations.ChildOf)
			while (ancestor?.isAlive()) {
				keep.add(ancestor)
				ancestor = ancestor.targetFor(relations.ChildOf)
			}
			keepSubtree(entity)
		}

		// Hide the rest. Skip already-invisible entities so isolating does not take ownership of user-hidden ones and reveal them on exit.
		for (const entity of world.query(traits.Name, traits.WorldMatrix)) {
			if (keep.has(entity)) continue
			if (!entity.has(traits.Invisible)) {
				entity.add(HiddenByIsolate, traits.Invisible)
			}
		}
	})
}
