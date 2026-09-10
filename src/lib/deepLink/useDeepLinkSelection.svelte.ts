import type { Entity, World } from 'koota'

import { onDestroy } from 'svelte'

import { traits, useWorld } from '$lib/ecs'

import { useDeepLinkParam } from './useDeepLink.svelte'

/**
 * Selects the entity carrying each of `names`, now if it exists and otherwise
 * the first time one appears. Each name is applied once and then forgotten, so
 * a later deselection by the user sticks. Selection is additive: nothing that is
 * already selected is cleared. Entities marked `NonSelectable` never match.
 *
 * Returns the function that stops waiting for the names still unresolved. It is
 * a no-op once every name has resolved.
 */
export const selectEntitiesByName = (world: World, names: readonly string[]): (() => void) => {
	const pending = new Set(names)

	let stopListeningForAdds: (() => void) | undefined
	let stopListeningForChanges: (() => void) | undefined

	const release = () => {
		stopListeningForAdds?.()
		stopListeningForChanges?.()
		stopListeningForAdds = undefined
		stopListeningForChanges = undefined
	}

	const resolve = (entity: Entity) => {
		const name = entity.get(traits.Name)
		if (name === undefined || !pending.has(name) || entity.has(traits.NonSelectable)) return

		if (!entity.has(traits.Selected)) entity.add(traits.Selected)
		pending.delete(name)
		if (pending.size === 0) release()
	}

	for (const entity of world.query(traits.Name)) {
		resolve(entity)
		if (pending.size === 0) break
	}

	if (pending.size > 0) {
		stopListeningForAdds = world.onAdd(traits.Name, resolve)
		stopListeningForChanges = world.onChange(traits.Name, resolve)
	}

	return release
}

/**
 * The names a `viz.select` value carries. The documented form is one
 * comma-separated list, and a repeated key flattens into the same list. Empty
 * segments are dropped, so a trailing comma is harmless.
 */
export const splitSelectNames = (values: readonly string[]): string[] =>
	values.flatMap((value) => value.split(',')).filter((name) => name !== '')

/** Core's own consumer of `viz.select`. Mounted once by `App.svelte`. */
export const useDeepLinkSelection = (): void => {
	const world = useWorld()
	let release: (() => void) | undefined

	useDeepLinkParam('select', (names) => {
		release = selectEntitiesByName(world, splitSelectNames(names))
	})

	onDestroy(() => release?.())
}
