import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'
import type { Entity } from 'koota'
import { traits } from '$lib/ecs'

export const useObjectEvents = (entity: () => Entity | undefined) => {
	const down = new Vector2()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const visibility = useVisibility()
	const cursor = useCursor()

	const currentEntity = $derived(entity())
	const visible = $derived(currentEntity ? (visibility.get(currentEntity) ?? true) : true)

	const onpointerenter = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerEnter()

		if (currentEntity && !currentEntity.has(traits.Hover)) {
			currentEntity.add(
				traits.Hover({
					index: -1,
					x: event.point.x,
					y: event.point.y,
					z: event.point.z,
				})
			)
		}
	}

	const onpointermove = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()

		if (currentEntity && currentEntity.has(traits.Hover)) {
			currentEntity.set(traits.Hover, {
				index: event.index ?? -1,
				x: event.point.x,
				y: event.point.y,
				z: event.point.z,
			})
		}
	}

	const onpointerleave = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerLeave()

		if (currentEntity?.has(traits.Hover)) {
			currentEntity.remove(traits.Hover)
		}
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
