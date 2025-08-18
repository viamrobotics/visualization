<script lang="ts">
	import { Box3, Object3D } from 'three'
	import { T, useTask } from '@threlte/core'
	import { useSelectedObject, useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { BoxHelper } from '$lib/three/BoxHelper'

	const box3 = new Box3()
	const box = new BoxHelper(new Object3D(), 0x000000)
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
				selected.current.metadata.getBoundingBoxAt?.(box3)
				box.setFromBox3(box3)
				return
			}

			if (clone) {
				selectedObject3d.current?.getWorldPosition(clone.position)
				selectedObject3d.current?.getWorldQuaternion(clone.quaternion)
				box.setFromObject(clone)
			}
		},
		{ autoStart: false }
	)

	$effect.pre(() => {
		if (selected.current) {
			start()
			box.visible = true
		} else {
			stop()
			box.visible = false
		}
	})
</script>

<T
	is={box}
	raycast={() => null}
/>
