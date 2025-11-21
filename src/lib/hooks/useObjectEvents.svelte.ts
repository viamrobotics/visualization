import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'
import type { Entity } from 'koota'

export const useObjectEvents = (entity: () => Entity | undefined) => {
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const visibility = useVisibility()
	const down = new Vector2()
	const currentEntity = $derived(entity())

	const cursor = useCursor()

	return {
		get visible() {
			if (!currentEntity) {
				return true
			}

			return visibility.get(currentEntity) ?? true
		},
		onpointerenter: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			cursor.onPointerEnter()
		},
		onpointerleave: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			cursor.onPointerLeave()
		},
		ondblclick: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			focusedEntity.set(currentEntity)
		},
		onpointerdown: (event: IntersectionEvent<MouseEvent>) => {
			down.copy(event.pointer)
		},
		onclick: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()

			if (down.distanceToSquared(event.pointer) < 0.1) {
				selectedEntity.set(currentEntity)
			}
		},
	}
}
