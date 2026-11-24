<script lang="ts">
	import GeometryFields from '#lib/components/overlay/details/GeometryFields.svelte'
	import {
		type GeometryDimension,
		sharedGeometryDimensions,
	} from '#lib/components/overlay/details/sharedGeometryDimensions.js'
	import { defaultFrameGeometry } from '#lib/defaultFrameGeometry.js'
	import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import {
		obstacleGeometriesOf,
		type ObstacleGeometryConfig,
		type ObstacleShape,
	} from '#lib/obstacleAttributes.js'

	interface Props {
		/** A component that `obstacleEditorType` classed as simple. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const partConfig = usePartConfig()

	const entry = $derived(obstacleGeometriesOf(component)[0])

	const write = (geometry: ObstacleShape) => {
		const { label, translation, orientation } = entry ?? {}
		const next: ObstacleGeometryConfig = {
			...geometry,
			...(label !== undefined && { label }),
			...(translation && { translation }),
			...(orientation && { orientation }),
		}

		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: [next] },
		})
	}
</script>

{#if entry}
	<GeometryFields
		type={entry.type}
		dimensions={sharedGeometryDimensions([entry as Partial<Record<GeometryDimension, number>>])}
		includeNone={false}
		ontypechange={(type) => {
			if (type !== 'none') write(defaultFrameGeometry(type) as ObstacleShape)
		}}
		ondimensionchange={(patch) => write({ ...entry, ...patch } as ObstacleShape)}
	/>
{/if}
