<script lang="ts">
	import { isInstanceOf, T, useTask } from '@threlte/core'
	import { useSelectedEntity, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'
	import { OBB } from 'three/addons/math/OBB.js'
	import { traits, useTrait } from '$lib/ecs'

	const obb = new OBB()
	const obbHelper = new OBBHelper()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const instance = useTrait(() => selectedEntity.current, traits.Instance)

	// Create a clone so that our bounding box doesn't include children
	const clone = $derived.by(() => {
		if (isInstanceOf(selectedObject3d.current, 'BatchedMesh')) {
			return
		}

		return selectedObject3d.current?.clone(false)
	})

	const { start, stop } = useTask(
		() => {
			if (selectedEntity.current === undefined) {
				return
			}

			if (isInstanceOf(selectedObject3d.current, 'BatchedMesh')) {
				if (instance.current) {
					selectedObject3d.current.getBoundingBoxAt(instance.current, obb)
					obbHelper.setFromOBB(obb)
				}

				return
			}

			if (clone) {
				selectedObject3d.current?.getWorldPosition(clone.position)
				selectedObject3d.current?.getWorldQuaternion(clone.quaternion)
				obbHelper.setFromObject(clone)
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
			obbHelper.visible = true
		} else {
			stop()
			obbHelper.visible = false
		}
	})
</script>

<T
	is={obbHelper}
	raycast={() => null}
	bvh={{ enabled: false }}
/>
