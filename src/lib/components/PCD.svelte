<script lang="ts">
	import type { ConfigurableTrait, Entity } from 'koota'

	import type { InteractionLayerValue } from '$lib/ecs/traits'

	import { createBufferGeometry } from '$lib/attribute'
	import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
	import { traits, useWorld } from '$lib/ecs'
	import { parsePcdInWorker } from '$lib/lib'

	interface Props {
		data: Uint8Array
		options?: {
			name?: string
			renderOrder?: number
			interactionLayers?: InteractionLayerValue[]
			oncreate?: (positions: Float32Array, colors: Uint8Array | undefined) => void
		}
	}

	let { data, options }: Props = $props()

	const world = useWorld()

	let entity: Entity

	$effect(() => {
		parsePcdInWorker(data).then(({ positions, colors }) => {
			const geometry = createBufferGeometry(positions, { colors, colorFormat: ColorFormat.RGB })

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(options?.name ?? 'Random points'),
				traits.Points,
				traits.BufferGeometry(geometry),
			]

			if (options?.renderOrder) {
				entityTraits.push(traits.RenderOrder(options.renderOrder))
			}
			if (options?.interactionLayers?.includes('selectTool')) {
				entityTraits.push(traits.SelectToolInteractionLayer)
			}

			entity = world.spawn(...entityTraits)

			options?.oncreate?.(positions, colors ?? undefined)
		})

		return () => {
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
