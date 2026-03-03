<script lang="ts">
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { createBufferGeometry } from '$lib/attribute'

	interface Props {
		positions: Float32Array
		colors: Uint8Array | null
	}

	let { positions, colors }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		const geometry = createBufferGeometry(positions, colors)

		entity = world.spawn(
			traits.Name('Random points'),
			traits.Points,
			traits.BufferGeometry(geometry)
		)

		return () => {
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
