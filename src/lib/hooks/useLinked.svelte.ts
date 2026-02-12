import { getContext, setContext } from 'svelte'
import type { Entity } from 'koota'
import { relations, useWorld } from '$lib/ecs'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'

const linkedKey = Symbol('linked-context')

interface LinkedEntitiesContext {
	readonly current: Entity[]
}

export const provideLinkedEntities = () => {
	const world = useWorld()
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	let linkedEntities = $derived(displayEntity?.targetsFor(relations.SubEntityLink) ?? [])

	const unsubAdd = world.onAdd(relations.SubEntityLink, (entity, target) => {
		if (entity === displayEntity) {
			linkedEntities = [...linkedEntities, target]
		}
	})

	const unsubRemove = world.onRemove(relations.SubEntityLink, (entity, target) => {
		if (entity === displayEntity) {
			linkedEntities = linkedEntities.filter((e) => e !== target)
		}
	})

	$effect(() => {
		return () => {
			unsubAdd()
			unsubRemove()
		}
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
