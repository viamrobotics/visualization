import { getContext, setContext } from 'svelte'
import type { Entity } from 'koota'
import { relations, useWorld } from '$lib/ecs'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte.ts'

const hoveredLinkedKey = Symbol('hovered-linked-context')

interface HoveredLinkedEntitiesContext {
	readonly current: Entity[]
}

export const provideHoveredLinkedEntities = () => {
	const world = useWorld()
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	let linkedEntities = $derived(displayEntity?.targetsFor(relations.HoverLink) ?? [])

	const unsubAdd = world.onAdd(relations.HoverLink, (entity, target) => {
		if (entity === displayEntity) {
			linkedEntities = [...linkedEntities, target]
		}
	})

	const unsubRemove = world.onRemove(relations.HoverLink, (entity, target) => {
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

	setContext<HoveredLinkedEntitiesContext>(hoveredLinkedKey, {
		get current() {
			return linkedEntities
		},
	})
}

export const useHoveredLinkedEntities = (): HoveredLinkedEntitiesContext => {
	return getContext<HoveredLinkedEntitiesContext>(hoveredLinkedKey)
}
