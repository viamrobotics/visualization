<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import { useSelectedObject, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { OBBHelper } from '$lib/three/OBBHelper'
	import { OBB } from 'three/addons/math/OBB.js'

	const obb = new OBB()
	const obbHelper = new OBBHelper()

	const { invalidate } = useThrelte()
	const selected = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()

	// Create a clone so that our bounding box doesn't include children
	const clone = $derived.by(() => {
		if (selected.current?.metadata.batched) {
			return
		}

		return selectedObject3d.current?.clone(false)
	})

	const { start, stop } = useTask(
		() => {
			if (selected.current === undefined) {
				return
			}

			if (selected.current.metadata.batched) {
				selected.current.metadata.getBoundingBoxAt?.(obb)
				obbHelper.setFromOBB(obb)
				invalidate()
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
		if (selected.current) {
			start()
			obbHelper.visible = true
		} else {
			stop()

			obbHelper.visible = false
		}

		invalidate()
		console.log('derp')
	})
</script>

<T
	is={obbHelper}
	raycast={() => null}
	bvh={{ enabled: false }}
/>
