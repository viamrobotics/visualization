<script>
	import { T } from '@threlte/core'
	import { untrack } from 'svelte'
	import { LineGeometry } from 'three/examples/jsm/Addons.js'

	let { positions, colors } = $props()

	let geometry = $state.raw(new LineGeometry())

	$effect(() => {
		if (positions) {
			untrack(() => {
				geometry = new LineGeometry()
				geometry.setPositions(positions)
				if (colors) geometry.setColors(colors)
			})
		}
	})
</script>

<T is={geometry} />
