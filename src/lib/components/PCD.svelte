<script lang="ts">
	import { parsePcdInWorker } from '$lib/lib'
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'
	import type { Entity } from 'koota'

	interface Props {
		data: Uint8Array
	}

	let { data }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		parsePcdInWorker(data).then(({ positions, colors }) => {
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
