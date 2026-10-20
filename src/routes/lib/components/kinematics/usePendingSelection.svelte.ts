import { traits, useQuery } from '$lib/ecs'
import { selectOnly } from '$lib/ecs/selectOnly'
import { useWorld } from '$lib/ecs/useWorld'

/**
 * Selects an entity by `traits.Name` once it exists. A new joint's entity spawns after the build
 * that follows the edit, so the name is remembered until then.
 */
export const usePendingSelection = () => {
	const world = useWorld()
	const named = useQuery(traits.Name)

	let pending = $state.raw<string>()

	$effect(() => {
		if (pending === undefined) return
		const match = named.current.find((entity) => entity.get(traits.Name) === pending)
		if (!match) return
		selectOnly(world, match)
		pending = undefined
	})

	return {
		/** Select the entity named `name` as soon as it is in the scene. */
		select(name: string) {
			pending = name
		},
	}
}
