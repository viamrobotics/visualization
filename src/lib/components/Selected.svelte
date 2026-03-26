<script lang="ts">
	import { isInstanceOf, T, useTask, useThrelte } from '@threlte/core'
	import { BatchedMesh, Box3 } from 'three'
	import { OBB } from 'three/addons/math/OBB.js'

	import type { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'

	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'

	const box3 = new Box3()
	const obb = new OBB()
	const obbHelper = new OBBHelper()

	const { invalidate } = useThrelte()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()

	const object = $derived(selectedObject3d.current)

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

	$effect(() => {
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
