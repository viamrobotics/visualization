<script lang="ts">
	import { isInstanceOf, T, useTask, useThrelte } from '@threlte/core'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'
	import { OBB } from 'three/addons/math/OBB.js'
	import { traits, useTrait } from '$lib/ecs'
	import { Box3 } from 'three'

	const box3 = new Box3()
	const obb = new OBB()
	const obbHelper = new OBBHelper()

	const { invalidate } = useThrelte()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const instance = useTrait(() => selectedEntity.current, traits.Instance)

	// Create a clone so that our bounding box doesn't include children
	const clone = $derived.by(() => {
		if (instance.current) {
			return
		}

		return selectedObject3d.current?.clone(false)
	})

	const { start, stop } = useTask(
		() => {
			if (selectedEntity.current === undefined) {
				return
			}

			if (isInstanceOf(selectedObject3d.current, 'BatchedMesh') && instance.current) {
				if (instance.current) {
					selectedObject3d.current.getBoundingBoxAt(instance.current, box3)
					obb.fromBox3(box3)
					obbHelper.setFromOBB(obb)
					invalidate()
				}

				return
			}

			if (clone) {
				selectedObject3d.current?.getWorldPosition(clone.position)
				selectedObject3d.current?.getWorldQuaternion(clone.quaternion)
				obbHelper.setFromObject(clone)
				invalidate()
			}
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
