import type { Entity } from 'koota'

import { getContext, setContext } from 'svelte'

import { relations, traits, useQuery, useWorld } from '#lib/ecs/index.js'

const linkedKey = Symbol('linked-context')

interface LinkedEntitiesContext {
	readonly current: Entity[]
}

export const provideLinkedEntities = () => {
	const world = useWorld()
	const selected = useQuery(traits.Selected)

	let linkedEntities = $derived(
		selected.current
			.flatMap((entity) => entity.targetFor(relations.SubEntityLink))
			.filter((entity) => entity !== undefined)
	)

	const unsubAdd = world.onAdd(relations.SubEntityLink, (entity, target) => {
		if (selected.current.includes(entity)) {
			linkedEntities = [...linkedEntities, target]
		}
	})

	const unsubRemove = world.onRemove(relations.SubEntityLink, (entity, target) => {
		if (selected.current.includes(entity)) {
			linkedEntities = linkedEntities.filter((e) => e !== target)
		}
	})

	const unsub = () => {
		unsubAdd()
		unsubRemove()
	}

	$effect(() => {
		return unsub
	})

	setContext<LinkedEntitiesContext>(linkedKey, {
		get current() {
			return linkedEntities
		},
	})
}

export const useLinkedEntities = (): LinkedEntitiesContext => {
	return getContext<LinkedEntitiesContext>(linkedKey)
}
