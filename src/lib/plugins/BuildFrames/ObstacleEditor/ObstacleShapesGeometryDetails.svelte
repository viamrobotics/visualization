<!--
@component

The geometry of several selected Complex obstacle shapes. A dimension that differs across them shows as a dash, and an edit writes only the field it changes to every shape.
-->
<script lang="ts">
	import GeometryFields from '#lib/components/overlay/details/GeometryFields.svelte'
	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import {
		type GeometryDimension,
		sharedGeometryDimensions,
	} from '#lib/components/overlay/details/sharedGeometryDimensions.js'
	import { MIXED, sharedValue } from '#lib/components/overlay/details/sharedValue.js'
	import { defaultFrameGeometry } from '#lib/defaultFrameGeometry.js'
	import { obstacleGeometriesOf, type ObstacleShape } from '#lib/obstacleAttributes.js'

	import { type SelectedObstacleShape, shapePatchEdits } from './selectedObstacleShapes'
	import { useObstacleShapeWrites } from './useObstacleShapeWrites'

	interface Props {
		/** The selected shapes. Never empty. */
		shapes: readonly SelectedObstacleShape[]
	}

	const { shapes }: Props = $props()

	const shapeWrites = useObstacleShapeWrites()

	const entries = $derived(
		shapes.map(({ component, index }) => obstacleGeometriesOf(component)[index])
	)

	const geometryType = $derived(sharedValue(entries.map((entry) => entry?.type)))

	const dimensions = $derived(
		sharedGeometryDimensions(
			entries as readonly (Partial<Record<GeometryDimension, number>> | undefined)[]
		)
	)

	let error = $state<string | undefined>()

	/** Writes one patch to every selected shape, so each keeps its own value for every field left alone. */
	const writeAll = (patch: Partial<ObstacleShape>) => {
		error = shapeWrites.write(
			shapePatchEdits(
				shapes,
				shapes.map(() => patch)
			)
		)
	}
</script>

{#if geometryType === MIXED}
	<SectionNotice
		label="geometry"
		message="The selected shapes have different geometry types."
	/>
{:else if geometryType !== 'box' && geometryType !== 'sphere' && geometryType !== 'capsule'}
	<SectionNotice
		label="geometry"
		message="The selected shapes have a geometry type that can't be edited here."
	/>
{:else}
	<GeometryFields
		includeNone={false}
		type={geometryType}
		{dimensions}
		ontypechange={(type) => {
			// A type switch replaces every shape's fields with that type's defaults.
			if (type !== 'none') writeAll(defaultFrameGeometry(type) as ObstacleShape)
		}}
		ondimensionchange={(patch) => writeAll({ type: geometryType, ...patch } as Partial<ObstacleShape>)}
	/>
{/if}

{#if error}
	<p
		role="alert"
		class="text-danger-dark text-xs"
	>
		{error}
	</p>
{/if}
