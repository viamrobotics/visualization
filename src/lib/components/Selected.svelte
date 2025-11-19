<script lang="ts">
	import { isInstanceOf, T, useTask } from '@threlte/core'
	import { useSelectedObject, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'
	import { OBB } from 'three/addons/math/OBB.js'
	import { traits } from '$lib/ecs'

	const obb = new OBB()
	const obbHelper = new OBBHelper()
	const selected = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()

	$inspect(selected)

	// Create a clone so that our bounding box doesn't include children
	const clone = $derived.by(() => {
		if (isInstanceOf(selectedObject3d.current, 'BatchedMesh')) {
			return
		}

		return selectedObject3d.current?.clone(false)
	})

	const { start, stop } = useTask(
		() => {
			if (selected.current === undefined) {
				return
			}

			if (isInstanceOf(selectedObject3d.current, 'BatchedMesh')) {
				const instance = selected.current.get(traits.Instance)
				if (instance) {
					selectedObject3d.current.getBoundingBoxAt(instance, obb)
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
		if (selected.current) {
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
