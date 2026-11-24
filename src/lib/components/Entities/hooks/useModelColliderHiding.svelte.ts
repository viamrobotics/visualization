import type { Entity } from 'koota'

import { traits, useWorld } from '#lib/ecs/index.js'
import { useSettings } from '#lib/hooks/useSettings.svelte.js'

/**
 * Keeps `ColliderHidden` on every entity drawing a `Model` while the setting asks for models
 * alone. `'colliders+model'` intentionally shows both, so it hides nothing.
 */
export const useModelColliderHiding = (): void => {
	const world = useWorld()
	const settings = useSettings()

	$effect(() => {
		const hideColliders = settings.current.renderArmModels === 'model'

		const sync = (entity: Entity) => {
			const shouldHide = hideColliders && entity.has(traits.Model)
			if (shouldHide === entity.has(traits.ColliderHidden)) return
			if (shouldHide) {
				entity.add(traits.ColliderHidden)
			} else {
				entity.remove(traits.ColliderHidden)
			}
		}

		for (const entity of world.query(traits.Model)) sync(entity)
		for (const entity of world.query(traits.ColliderHidden)) sync(entity)

		const unsubscribes = [
			world.onAdd(traits.Model, sync),
			// Koota runs `onRemove` while the trait is still on the entity, so `sync` would keep the hide.
			world.onRemove(traits.Model, (entity) => {
				if (entity.has(traits.ColliderHidden)) entity.remove(traits.ColliderHidden)
			}),
		]

		return () => {
			for (const unsubscribe of unsubscribes) unsubscribe()
		}
	})
}
