<script lang="ts">
	import type { ConfigurableTrait, Entity } from 'koota'

	import type { InteractionLayerValue } from '#lib/ecs/traits.js'

	import { createBufferGeometry } from '#lib/attribute.js'
	import { ColorFormat } from '#lib/buf/draw/v1/metadata_pb.js'
	import { traits, useWorld } from '#lib/ecs/index.js'
	import { parsePcdInWorker } from '#lib/loaders/pcd/index.js'
	import { attachPointsBvh } from '#lib/three/pointsBvh.js'

	interface Props {
		data: Uint8Array
		name?: string
		renderOrder?: number
		depthTest?: boolean
		depthWrite?: boolean
		color?: { r: number; g: number; b: number }
		interactionLayers?: InteractionLayerValue[]
		oncreate?: (positions: Float32Array, colors: Uint8Array | undefined) => void
	}

	let {
		data,
		name,
		renderOrder,
		depthTest,
		depthWrite,
		color,
		interactionLayers,
		oncreate,
	}: Props = $props()

	const world = useWorld()

	$effect(() => {
		let entity: Entity | undefined
		let cancelled = false

		parsePcdInWorker(data).then(({ boundsTree, positions, colors, bounds, shuffled }) => {
			if (cancelled) return

			const geometry = createBufferGeometry(
				positions,
				{ colors, colorFormat: ColorFormat.RGB },
				bounds
			)
			if (boundsTree) attachPointsBvh(geometry, boundsTree)

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(name ?? 'Random points'),
				traits.Points,
				traits.BufferGeometry(geometry),
				traits.PointSampling({ total: positions.length / 3, shuffled }),
			]

			if (renderOrder) {
				entityTraits.push(traits.RenderOrder(renderOrder))
			}

			if (depthTest !== undefined || depthWrite !== undefined) {
				entityTraits.push(
					traits.Material({ depthTest: depthTest ?? true, depthWrite: depthWrite ?? true })
				)
			}
			if (color !== undefined) {
				geometry.deleteAttribute('color')
				entityTraits.push(traits.Color({ r: color.r, g: color.g, b: color.b }))
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
