<script>
	import { LineGeometry } from 'three/examples/jsm/Addons.js'
	import { T } from '@threlte/core'
	import { untrack } from 'svelte'

	let { positions } = $props()

	let geometry = $state.raw(new LineGeometry())

	$effect(() => {
		if (positions) {
			untrack(() => {
				geometry = new LineGeometry()
				geometry.setPositions(positions)
			})
		}
	})
</script>

<T is={geometry} />
