<!--
@component

The geometry of several selected Complex obstacle shapes. A dimension that differs across them shows as a dash, and an edit writes only the field it changes to every shape.
-->
<script lang="ts">
	import type { EditableFrameGeometry } from '#lib/defaultFrameGeometry.js'

	import GeometryFields from '#lib/components/overlay/details/GeometryFields.svelte'
	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import {
		changedAxes,
		MIXED,
		sharedNumber,
		sharedValue,
		toInputNumber,
	} from '#lib/components/overlay/details/sharedValue.js'
	import { obstacleGeometriesOf, type ObstacleShape } from '#lib/obstacleAttributes.js'

	import { type SelectedObstacleShape, shapePatchEdits } from './selectedObstacleShapes'
	import { useObstacleShapeWrites } from './useObstacleShapeWrites'

	interface Props {
		/** The selected shapes. Never empty. */
		shapes: readonly SelectedObstacleShape[]
	}

	const { shapes }: Props = $props()

	const writeShapes = useObstacleShapeWrites()

	const entries = $derived(
		shapes.map(({ component, index }) => obstacleGeometriesOf(component)[index])
	)

	const geometryType = $derived(sharedValue(entries.map((entry) => entry?.type)))

	/** One dimension across shapes that share a type, as the number its input shows. */
	const shownDimension = (key: 'x' | 'y' | 'z' | 'r' | 'l'): number =>
		toInputNumber(
			sharedNumber(
				entries.map(
					(entry) => (entry as Partial<Record<typeof key, number>> | undefined)?.[key] ?? Number.NaN
				)
			)
		)

	// Mixed dimensions are handed over as NaN, which the fields show as a dash.
	const geometry = $derived.by((): EditableFrameGeometry | undefined => {
		if (geometryType === 'box') {
			return { type: 'box', x: shownDimension('x'), y: shownDimension('y'), z: shownDimension('z') }
		}
		if (geometryType === 'sphere') return { type: 'sphere', r: shownDimension('r') }
		if (geometryType === 'capsule') {
			return { type: 'capsule', r: shownDimension('r'), l: shownDimension('l') }
		}
		return undefined
	})

	let error = $state<string | undefined>()

	const dimensionsOf = (shape: EditableFrameGeometry): Record<string, number> =>
		Object.fromEntries(Object.entries(shape).filter(([key]) => key !== 'type'))

	const handleChange = (next: EditableFrameGeometry) => {
		if (next.type === 'none' || !geometry) return

		// A type switch replaces every shape's fields with that type's defaults. Otherwise each shape
		// keeps its own value for every dimension left alone.
		const patch =
			next.type === geometry.type
				? changedAxes(dimensionsOf(geometry), dimensionsOf(next))
				: (next as ObstacleShape)
		if (Object.keys(patch).length === 0) return

		error = writeShapes(
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
{:else}
	<GeometryFields
		includeNone={false}
		{geometry}
		onchange={handleChange}
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
