import type { Entity, World } from 'koota'

import * as traits from './traits'

/** Makes `entities` the whole selection, in the order given, clearing whatever was selected before. */
export const selectOnly = (world: World, ...entities: Entity[]): void => {
	const keep = new Set(entities)
	for (const selected of world.query(traits.Selected)) {
		if (!keep.has(selected)) selected.remove(traits.Selected)
	}

	for (const entity of entities) {
		if (!entity.has(traits.Selected)) entity.add(traits.Selected)
	}
}
