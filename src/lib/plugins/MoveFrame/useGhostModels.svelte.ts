import type { Entity } from 'koota'

import { traits, useWorld } from '#lib/ecs/index.js'
import { matchModel, syncModelTrait, use3DModels } from '#lib/hooks/use3DModels.svelte.js'

/**
 * Hands each ghost the 3D model of the link it copies, named by its `GhostModelKey`, so the ghost
 * draws the way its live link does. Follows models finishing loading and the provider's display.
 */
export const useGhostModels = (): void => {
	const world = useWorld()
	const models = use3DModels()

	$effect(() => {
		const loaded = models.shouldRender ? models.current : {}
		const { display } = models
		const sync = (entity: Entity) =>
			syncModelTrait(entity, matchModel(entity.get(traits.GhostModelKey), loaded), display)

		for (const entity of world.query(traits.GhostModelKey)) sync(entity)

		return world.onAdd(traits.GhostModelKey, sync)
	})
}
