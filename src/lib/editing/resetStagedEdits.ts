import type { World } from 'koota'

import { traits } from '$lib/ecs'

/**
 * Drop every staged frame edit, reverting the scene to its saved-config poses.
 * Removing `EditedMatrix` collapses each frame's WorldMatrix blend back to the
 * live/baseline pose. Pairs with discarding the part config.
 */
export const resetStagedEdits = (world: World): void => {
	for (const entity of world.query(traits.EditedMatrix)) {
		entity.remove(traits.EditedMatrix)
	}
}
