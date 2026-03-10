<script lang="ts">
	import { isInstanceOf, T, useTask, useThrelte } from '@threlte/core'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'
	import { OBB } from 'three/addons/math/OBB.js'
	import { BatchedMesh, Box3 } from 'three'
	import type { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'

	const box3 = new Box3()
	const obb = new OBB()
	const obbHelper = new OBBHelper()

	const { invalidate } = useThrelte()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()

	const object = $derived.by(() => {
		if (!selectedObject3d.current) {
			return
		}

		// Create a clone in the case of meshes, which could be frames with geometries,
		// so that our bounding box doesn't include children
		if (isInstanceOf(selectedObject3d.current, 'Mesh')) {
			return selectedObject3d.current?.clone(false)
		}

		return selectedObject3d.current
	})

	const { start, stop } = useTask(
		() => {
			if (object === undefined) {
				return
			}

			if (
				selectedEntity.instance &&
				(isInstanceOf(object, 'BatchedMesh') || (object as InstancedArrows).isInstancedArrows)
			) {
				const mesh = object as BatchedMesh | InstancedArrows
				mesh.getBoundingBoxAt(selectedEntity.instance, box3)
				obb.fromBox3(box3)
				obbHelper.setFromOBB(obb)
			} else if (isInstanceOf(selectedObject3d.current, 'Mesh')) {
				selectedObject3d.current?.getWorldPosition(object.position)
				selectedObject3d.current?.getWorldQuaternion(object.quaternion)
				obbHelper.setFromObject(object)
			} else {
				obbHelper.setFromObject(object)
			}

			invalidate()
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect.pre(() => {
		if (selectedEntity.current) {
			start()
		} else {
			stop()
		}

		invalidate()
	})
</script>

{#if selectedEntity.current}
	<T
		is={obbHelper}
		dispose={false}
		raycast={() => null}
		bvh={{ enabled: false }}
	/>
{/if}
