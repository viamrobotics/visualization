<script lang="ts">
	import type { ConfigurableTrait, Entity } from 'koota'

	import type { InteractionLayerValue } from '$lib/ecs/traits'

	import { createBufferGeometry } from '$lib/attribute'
	import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
	import { traits, useWorld } from '$lib/ecs'
	import { parsePcdInWorker } from '$lib/lib'

	interface Props {
		data: Uint8Array
		name?: string
		renderOrder?: number
		depthTest?: boolean
		depthWrite?: boolean
		interactionLayers?: InteractionLayerValue[]
		oncreate?: (positions: Float32Array, colors: Uint8Array | undefined) => void
	}

	let { data, name, renderOrder, depthTest, depthWrite, interactionLayers, oncreate }: Props = $props()

	const world = useWorld()

	$effect(() => {
		let entity: Entity | undefined
		let cancelled = false

		parsePcdInWorker(data).then(({ positions, colors }) => {
			if (cancelled) return

			const geometry = createBufferGeometry(positions, { colors, colorFormat: ColorFormat.RGB })

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(name ?? 'Random points'),
				traits.Points,
				traits.BufferGeometry(geometry),
			]

			if (renderOrder) {
				entityTraits.push(traits.RenderOrder(renderOrder))
			}
			if (depthTest !== undefined || depthWrite !== undefined) {
				entityTraits.push(traits.Material({ depthTest: depthTest ?? true, depthWrite: depthWrite ?? true }))
			}
			if (interactionLayers?.includes('selectTool')) {
				entityTraits.push(traits.SelectToolInteractionLayer)
			}

			entity = world.spawn(...entityTraits)

			oncreate?.(positions, colors ?? undefined)
		})

		return () => {
			cancelled = true
			if (entity && world.has(entity)) {
				entity.destroy()
			}
		}
	})
</script>
