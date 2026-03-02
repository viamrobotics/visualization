<script lang="ts">
	import LassoTool from '$lib/components/Lasso/Tool.svelte'

	import { parsePcdInWorker } from '$lib/lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'

	const world = useWorld()

	const init = async () => {
		const uint8array = await createRandomPcdBinary(10_000, 1)
		const value = await parsePcdInWorker(uint8array)
		const geometry = createBufferGeometry(value.positions, value.colors)
		world.spawn(traits.Name('Random points'), traits.Points, traits.BufferGeometry(geometry))
	}

	init()
</script>

<LassoTool
	enabled
	onSelection={() => {
		/* do something */
	}}
/>
