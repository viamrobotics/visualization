<script lang="ts">
	import type { ConfigurableTrait, Entity } from 'koota'

	import { createBufferGeometry } from '$lib/attribute'
	import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
	import { traits, useWorld } from '$lib/ecs'
	import { parsePcdInWorker } from '$lib/lib'

	interface Props {
		data: Uint8Array
		name?: string
		renderOrder?: number
		oncreate?: (positions: Float32Array, colors: Uint8Array | undefined) => void
	}

	let { data, name, renderOrder, oncreate }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		parsePcdInWorker(data).then(({ positions, colors }) => {
			const geometry = createBufferGeometry(positions, { colors, colorFormat: ColorFormat.RGB })

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(name ?? 'Random points'),
				traits.Points,
				traits.BufferGeometry(geometry),
			]

			if (renderOrder) {
				entityTraits.push(traits.RenderOrder(renderOrder))
			}

			entity = world.spawn(...entityTraits)

			oncreate?.(positions, colors ?? undefined)
		})

		return () => {
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
