<script lang="ts">
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'
	import { parsePcd } from '$lib/loaders/pcd'

	interface Props {
		data: Uint8Array
	}

	let { data }: Props = $props()

	const world = useWorld()

	$effect(() => {
		const { positions, colors } = parsePcd(data)
		const geometry = createBufferGeometry(positions, colors)

		world.spawn(traits.Name('Random points'), traits.Points, traits.BufferGeometry(geometry))
	})
</script>
