<script lang="ts">
	import { Box3, Object3D } from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { useSelectedObject } from '$lib/hooks/useSelection.svelte'
	import { BoxHelper } from '$lib/three/BoxHelper'

	const { scene } = useThrelte()

	const box = new BoxHelper(new Object3D(), 0x000000)
	const selected = useSelectedObject()

	const { start, stop } = useTask(() => box.update(), { autoStart: false })

	const box3 = new Box3()

	$effect.pre(() => {
		if (selected.current) {
			start()
		} else {
			stop()
		}
	})

	$effect.pre(() => {
		if (!selected.current) {
			box.visible = false
			return
		}

		box.visible = true

		if (selected.current.metadata.batched) {
			selected.current.metadata.getBoundingBoxAt?.(box3)
			box.setFromBox3(box3)
		} else {
			const object3d = scene.getObjectByProperty('uuid', selected.current.uuid)
			if (object3d) {
				// Create a clone so that our bounding box doesn't include children
				const clone = object3d.clone(false)
				object3d.getWorldPosition(clone.position)
				object3d.getWorldQuaternion(clone.quaternion)
				box.setFromObject(clone)
			}
		}
	})
</script>

<T is={box} />
