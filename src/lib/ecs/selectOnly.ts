import type { Entity, World } from 'koota'

import * as traits from './traits'

/** Makes `entity` the only selection, clearing whatever was selected before. */
export const selectOnly = (world: World, entity: Entity): void => {
	for (const selected of world.query(traits.Selected)) {
		if (selected !== entity) selected.remove(traits.Selected)
	}

	if (!entity.has(traits.Selected)) entity.add(traits.Selected)
}
