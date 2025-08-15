<script lang="ts">
	import { Box3, Object3D } from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { useSelectedObject } from '$lib/hooks/useSelection.svelte'
	import { BoxHelper } from '$lib/three/BoxHelper'

	const { scene } = useThrelte()

	const box = new BoxHelper(new Object3D(), 0x000000)
	const selected = useSelectedObject()
	const object3d = $derived.by(() => {
		if (selected.current === undefined) {
			return
		}

		return scene.getObjectByProperty('uuid', selected.current.uuid)
	})
	const clone = $derived.by(() => {
		if (selected.current?.metadata.batched) {
			return
		}

		return object3d?.clone(false)
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
				// Create a clone so that our bounding box doesn't include children
				object3d?.getWorldPosition(clone.position)
				object3d?.getWorldQuaternion(clone.quaternion)
				box.setFromObject(clone)
			}
		},
		{ autoStart: false }
	)

	const box3 = new Box3()

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
