<script lang="ts">
	import { parsePcdInWorker } from '$lib/lib'
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'
	import type { Entity } from 'koota'

	interface Props {
		buffer: Uint8Array
	}

	let { buffer }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		parsePcdInWorker(buffer).then(({ positions, colors }) => {
			const geometry = createBufferGeometry(positions, colors)

			entity = world.spawn(
				traits.Name('Random points'),
				traits.Points,
				traits.BufferGeometry(geometry)
			)
		})

		return () => {
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
