import type { Entity, Relation, Trait } from 'koota'

import { untrack } from 'svelte'

import { useWorld } from './useWorld'

/**
 * Maps each entity's traits to a value with `read`, re-reading whenever a `watched`
 * trait or relation is added to, changed on, or removed from any of them. One
 * subscription per watched trait covers every entity, where `useTrait` takes one each.
 *
 * @param entities The entities to read, in the order the results come back.
 * @param watched Every trait and relation `read` depends on. One left out goes stale.
 * @param read Runs inside a `$derived`, so any reactive state it touches is tracked too.
 */
export const useMappedEntitiesTraits = <TValue>(
	entities: () => readonly Entity[],
	watched: readonly (Trait | Relation<Trait>)[],
	read: (entity: Entity) => TValue
): { readonly current: TValue[] } => {
	const world = useWorld()

	let version = $state(0)

	// Callers often pass a fresh array of the same entities, so subscriptions follow the ids, not the array.
	const membership = $derived(entities().join(','))

	$effect(() => {
		void membership
		const members = new Set(untrack(entities))
		// Subscribers run inside whichever effect set the trait. Untracked, so `++` doesn't make
		// that effect depend on `version` and re-run itself.
		const bump = (entity: Entity) => {
			if (members.has(entity)) untrack(() => version++)
		}

		const unsubscribes = watched.flatMap((trait) => [
			world.onAdd(trait, bump),
			world.onChange(trait, bump),
			world.onRemove(trait, bump),
		])

		return () => {
			for (const unsubscribe of unsubscribes) unsubscribe()
		}
	})

	const current = $derived.by(() => {
		void version
		return entities().map((entity) => read(entity))
	})

	return {
		get current() {
			return current
		},
	}
}
