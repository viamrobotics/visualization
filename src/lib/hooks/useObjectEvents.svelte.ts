import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'
import type { Entity } from 'koota'
import { traits } from '$lib/ecs'
import { updateHoverInfo } from '$lib/HoverUpdater.svelte'

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

		if (currentEntity && !currentEntity.has(traits.Hovered)) {
			const hoverInfo = updateHoverInfo(currentEntity, event)
			if (hoverInfo) {
				currentEntity.add(
					traits.InstancedPose({
						index: hoverInfo.index,
						x: hoverInfo.x,
						y: hoverInfo.y,
						z: hoverInfo.z,
						oX: hoverInfo.oX,
						oY: hoverInfo.oY,
						oZ: hoverInfo.oZ,
						theta: hoverInfo.theta,
					})
				)
			}
			currentEntity.add(traits.Hovered)
		}
	}

	const onpointermove = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()

		if (currentEntity && currentEntity.has(traits.Hovered)) {
			const hoverInfo = updateHoverInfo(currentEntity, event)
			if (hoverInfo) {
				currentEntity.set(traits.InstancedPose, {
					index: hoverInfo.index,
					x: hoverInfo.x,
					y: hoverInfo.y,
					z: hoverInfo.z,
					oX: hoverInfo.oX,
					oY: hoverInfo.oY,
					oZ: hoverInfo.oZ,
					theta: hoverInfo.theta,
				})
			}
		}
	}

	const onpointerleave = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerLeave()

		if (currentEntity?.has(traits.Hovered)) {
			currentEntity.remove(traits.Hovered)
		}
		if (currentEntity?.has(traits.InstancedPose)) {
			currentEntity.remove(traits.InstancedPose)
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
