<script lang="ts">
	import Lasso from '$lib/components/Lasso/Lasso.svelte'
	import { parsePcdInWorker } from '$lib/lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'

	const world = useWorld()

	const uint8array = createRandomPcdBinary(10_000, 10)
	parsePcdInWorker(uint8array).then((value) => {
		const geometry = createBufferGeometry(value.positions, value.colors)

		world.spawn(traits.Name('Random points'), traits.Points, traits.BufferGeometry(geometry))
	})
</script>

<Lasso />
