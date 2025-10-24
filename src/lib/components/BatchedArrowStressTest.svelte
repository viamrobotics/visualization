<!-- TODO: Delete this component. -->

<script lang="ts">
	import { T } from '@threlte/core'
	import { onMount } from 'svelte'
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import { Color, Vector3 } from 'three'

	const batchedArrow = new BatchedArrow({ maxArrows: 100_000 })

	onMount(() => {
		const direction = new Vector3(0, 1, 0)
		const origin = new Vector3()
		const color = new Color()

		for (let i = 0; i < 100_000; i++) {
			origin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5)
			direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
			color.setHSL(Math.random(), 1, 0.5)
			batchedArrow.addArrow(direction, origin, 0.1, color)
		}
	})
</script>

<T is={batchedArrow.object3d} />
