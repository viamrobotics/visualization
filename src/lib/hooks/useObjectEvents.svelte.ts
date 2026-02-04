import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'
import type { Entity } from 'koota'
import { useHoverInfo } from './useHoverPosition.svelte'

export const useObjectEvents = (entity: () => Entity | undefined) => {
	const down = new Vector2()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const visibility = useVisibility()
	const cursor = useCursor()
	const hoverInfo = useHoverInfo()

	const currentEntity = $derived(entity())
	const visible = $derived(currentEntity ? (visibility.get(currentEntity) ?? true) : true)

	const onpointerenter = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerEnter()
		hoverInfo.entity = currentEntity
	}

	const onpointermove = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		hoverInfo.position = event.point.clone()
	}

	const onpointerleave = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerLeave()
	}

	const ondblclick = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		focusedEntity.set(currentEntity, event.instanceId ?? event.batchId)
	}

	const onpointerdown = (event: IntersectionEvent<MouseEvent>) => {
		down.copy(event.pointer)
	}

	const onclick = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()

		if (down.distanceToSquared(event.pointer) < 0.1) {
			selectedEntity.set(currentEntity, event.instanceId ?? event.batchId)
		}
	}

	$effect(() => {
		if (!visible) {
			cursor.onPointerLeave()
		}
	})

	return {
		get visible() {
			return visible
		},
		onpointerenter,
		onpointermove,
		onpointerleave,
		ondblclick,
		onpointerdown,
		onclick,
	}
}
