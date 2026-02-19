<script>
	import { T, useThrelte } from '@threlte/core'
	import { Line2 } from 'three/examples/jsm/lines/Line2.js'
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
	import { untrack } from 'svelte'

	let { positions } = $props()

	let geometry = $state.raw(new LineGeometry())

	const material = new LineMaterial()
	const line = new Line2()
	material.linewidth = 1
	material.color.set('red')
	material.depthTest = false
	material.depthWrite = false

	const { invalidate } = useThrelte()

	$effect(() => {
		if (!positions || positions.length === 0) {
			return
		}

		untrack(() => {
			geometry = new LineGeometry()
			geometry.setPositions(positions)
			invalidate()
		})
	})
</script>

<T
	is={line}
	frustumCulled={false}
	renderOrder={Number.POSITIVE_INFINITY}
>
	<T is={geometry} />
	<T is={material} />
</T>
