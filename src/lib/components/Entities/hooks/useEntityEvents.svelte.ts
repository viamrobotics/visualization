import type { Entity } from 'koota'

import { type IntersectionEvent, useCursor } from '@threlte/extras'
import { Vector2 } from 'three'

import { traits, useTrait } from '$lib/ecs'
import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'
import { updateHoverInfo } from '$lib/HoverUpdater.svelte'
import { createPose, matrixToPose, poseToMatrix } from '$lib/transform'

export const useEntityEvents = (entity: () => Entity | undefined) => {
	const down = new Vector2()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const cursor = useCursor()
	const invisible = useTrait(entity, traits.Invisible)

	const onpointerenter = (event: IntersectionEvent<MouseEvent>) => {
		if (invisible.current) return

		event.stopPropagation()
		cursor.onPointerEnter()

		const currentEntity = entity()

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
		if (invisible.current) return

		event.stopPropagation()

		const currentEntity = entity()

		if (currentEntity?.has(traits.Hovered)) {
			const hoverInfo = updateHoverInfo(currentEntity, event)
			const hoverPose = createPose(
				hoverInfo
					? {
							x: hoverInfo.x,
							y: hoverInfo.y,
							z: hoverInfo.z,
							oX: 0,
							oY: 0,
							oZ: 1,
							theta: 0,
						}
					: undefined
			)

			const worldPose = currentEntity.get(traits.WorldPose) ?? createPose()
			const hoverPoseMatrix = poseToMatrix(hoverPose)
			const worldPoseMatrix = poseToMatrix(worldPose)
			const resultMatrix = worldPoseMatrix.multiply(hoverPoseMatrix)
			const resultPose = matrixToPose(resultMatrix)

			if (hoverInfo) {
				currentEntity.set(traits.InstancedPose, {
					index: hoverInfo.index,
					x: resultPose.x,
					y: resultPose.y,
					z: resultPose.z,
					oX: resultPose.oX,
					oY: resultPose.oY,
					oZ: resultPose.oZ,
					theta: resultPose.theta,
				})
			}
		}
	}

	const onpointerleave = (event: IntersectionEvent<MouseEvent>) => {
		event.stopPropagation()
		cursor.onPointerLeave()

		const currentEntity = entity()

		if (currentEntity?.has(traits.Hovered)) {
			currentEntity.remove(traits.Hovered)
		}
		if (currentEntity?.has(traits.InstancedPose)) {
			currentEntity.remove(traits.InstancedPose)
		}
	}

	const ondblclick = (event: IntersectionEvent<MouseEvent>) => {
		if (invisible.current) return

		event.stopPropagation()

		const currentEntity = entity()
		focusedEntity.set(currentEntity, event.instanceId ?? event.batchId)
	}

	const onpointerdown = (event: IntersectionEvent<MouseEvent>) => {
		if (invisible.current) return

		down.copy(event.pointer)
	}

	const onclick = (event: IntersectionEvent<MouseEvent>) => {
		if (invisible.current) return

		event.stopPropagation()

		if (down.distanceToSquared(event.pointer) < 0.1) {
			const currentEntity = entity()
			selectedEntity.set(currentEntity, event.instanceId ?? event.batchId)
		}
	}

	$effect(() => {
		if (invisible.current) {
			cursor.onPointerLeave()

			const currentEntity = entity()
			if (currentEntity?.has(traits.Hovered)) {
				currentEntity.remove(traits.Hovered)
			}
			if (currentEntity?.has(traits.InstancedPose)) {
				currentEntity.remove(traits.InstancedPose)
			}
		}
	})

	return {
		onpointerenter,
		onpointermove,
		onpointerleave,
		ondblclick,
		onpointerdown,
		onclick,
	}
}
