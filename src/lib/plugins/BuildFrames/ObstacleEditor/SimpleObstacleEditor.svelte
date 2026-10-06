<script lang="ts">
	import GeometryFields from '$lib/components/overlay/details/GeometryFields.svelte'
	import { type EditableFrameGeometry } from '$lib/defaultFrameGeometry'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import {
		obstacleGeometriesOf,
		type ObstacleGeometryConfig,
		type ObstacleShape,
	} from '$lib/obstacleAttributes'

	interface Props {
		/** A component that `obstacleEditorType` classed as simple. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const partConfig = usePartConfig()

	const entry = $derived(obstacleGeometriesOf(component)[0])

	const handleChange = (geometry: EditableFrameGeometry) => {
		if (geometry.type === 'none') return

		const { label, translation, orientation } = entry ?? {}
		const next: ObstacleGeometryConfig = {
			...(geometry as ObstacleShape),
			...(label !== undefined && { label }),
			...(translation && { translation }),
			...(orientation && { orientation }),
		}

		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: [next] },
		})
	}
</script>

<GeometryFields
	geometry={entry}
	includeNone={false}
	onchange={handleChange}
/>
