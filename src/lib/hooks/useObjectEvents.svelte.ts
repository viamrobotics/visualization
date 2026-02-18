import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocusedEntity, useSelectedEntity } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Quaternion, Vector2 } from 'three'
import type { Entity } from 'koota'
import { traits } from '$lib/ecs'
import { updateHoverInfo } from '$lib/HoverUpdater.svelte'
import { useSelectedObject3d, useFocusedObject3d } from './useSelection.svelte'

import { useTask } from '@threlte/core'
import { OrientationVector } from '$lib/three/OrientationVector'
import { MathUtils, Vector3 } from 'three'
import { createPose, matrixToPose, poseToMatrix } from '../transform.ts';

const vec3 = new Vector3()
const quaternion = new Quaternion()
const ov = new OrientationVector()

	
export const useObjectEvents = (entity: () => Entity | undefined) => {
	const down = new Vector2()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const selectedObject3d = useSelectedObject3d()
	const focusedObject3d = useFocusedObject3d()
	const visibility = useVisibility()
	const cursor = useCursor()
	const currentEntity = $derived(entity())
	const visible = $derived(currentEntity ? (visibility.get(currentEntity) ?? true) : true)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })

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
		console.log('onpointermove', event)

		if (currentEntity && currentEntity.has(traits.Hovered)) {
			const hoverInfo = updateHoverInfo(currentEntity, event)
			const hoverPose = createPose(hoverInfo ? {
				x: hoverInfo.x,
				y: hoverInfo.y,
				z: hoverInfo.z,
				oX: 0,
				oY: 0,
				oZ: 1,
				theta: 0,
			} : undefined)
			console.log(worldOrientation.th)
			const worldPose = createPose({
				x: worldPosition.x,
				y: worldPosition.y,
				z: worldPosition.z,
				oX: worldOrientation.x,
				oY: worldOrientation.y,
				oZ: worldOrientation.z,
				theta: MathUtils.radToDeg(worldOrientation.th),
			})
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

	const { start, stop } = useTask(
		() => {
			object3d?.getWorldPosition(vec3)
			if (!vec3.equals(worldPosition)) {
				worldPosition.x = vec3.x
				worldPosition.y = vec3.y
				worldPosition.z = vec3.z
			}

			object3d?.getWorldQuaternion(quaternion)
			ov.setFromQuaternion(quaternion)

			if (!ov.equals(worldOrientation)) {
				worldOrientation.x = ov.x
				worldOrientation.y = ov.y
				worldOrientation.z = ov.z
				worldOrientation.th = ov.th
			}
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect.pre(() => {
		if (object3d) {
			start()
		} else {
			stop()
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
