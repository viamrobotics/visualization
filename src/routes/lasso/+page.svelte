<script lang="ts">
	import { LassoTool, PCD } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
	import { parsePcdInWorker } from '$lib/loaders/pcd'

	let pcdPositions = $state<Float32Array>(new Float32Array(0))
	let pcdColors = $state<Uint8Array | null>(null)
	let pcdData = $state<Uint8Array | null>(null)

	$effect(() => {
		createRandomPcdBinary(10_000, 1).then((data) => {
			pcdData = data
		})
	})

	$effect(() => {
		if (!pcdData) return

		parsePcdInWorker(pcdData).then(({ positions, colors }) => {
			pcdPositions = positions
			pcdColors = colors
		})
	})
</script>

<LassoTool
	enabled
	onSelection={() => {
		/* do something */
	}}
/>

{#if pcdPositions.length > 0 && pcdColors}
	<PCD
		positions={pcdPositions}
		colors={pcdColors}
	/>
{/if}
