import type { Entity } from 'koota'

import { traits, useQuery } from '$lib/ecs'

/**
 * Identifies a frame entity.
 *
 * A frame's name is not unique in the world on its own: `drawTransform` names each drawn
 * transform after its reference frame (`$lib/draw.ts`), and a configured component with no
 * frame gets a `FramelessComponent` entity under its own name. `FramesAPI` narrows the
 * query to actual frames, so dropping it resolves names onto those instead.
 */
export const FRAME_ENTITY_QUERY = [traits.FramesAPI, traits.Name]

/** `useFrames` keys its entities `${partID}:${name}`, so a name identifies at most one. */
export const frameEntitiesByName = (entities: readonly Entity[]): Map<string, Entity> => {
	const byName = new Map<string, Entity>()

	for (const entity of entities) {
		const name = entity.get(traits.Name)
		if (name !== undefined) byName.set(name, entity)
	}

	return byName
}

/**
 * The machine's frame entities by name.
 *
 * An entry may not have a `WorldMatrix` yet. A frame is spawned carrying `Matrix`, and
 * `installWorldMatrixListeners` adds `WorldMatrix` in a later microtask, so a frame is
 * queryable before it has a pose.
 */
export const useFrameEntities = () => {
	const entities = useQuery(...FRAME_ENTITY_QUERY)

	const current = $derived(frameEntitiesByName(entities.current))

	return {
		get current() {
			return current
		},
	}
}
