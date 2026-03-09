<script lang="ts">
	import { parsePcdInWorker } from '$lib/lib'
	import { traits, useWorld } from '$lib/ecs'
	import { createBufferGeometry } from '$lib/attribute'
	import type { ConfigurableTrait, Entity } from 'koota'

	interface Props {
		data: Uint8Array
		name?: string
		renderOrder?: number
	}

	let { data, name, renderOrder }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		parsePcdInWorker(data).then(({ positions, colors }) => {
			const geometry = createBufferGeometry(positions, colors)

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(name ?? 'Random points'),
				traits.Points,
				traits.BufferGeometry(geometry),
			]

			if (renderOrder) {
				entityTraits.push(traits.RenderOrder(renderOrder))
			}

			entity = world.spawn(...entityTraits)
		})

		return () => {
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
