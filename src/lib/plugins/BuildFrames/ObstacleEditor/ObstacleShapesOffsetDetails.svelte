<!--
@component

The offsets of several selected Complex obstacle shapes from their obstacles. A value that differs across them shows as a dash, and an edit writes only the field it changes to every shape.
-->
<script lang="ts">
	import type { ObstacleGeometryPatch } from '#lib/obstacleGeometryList.js'

	import SharedPoseFields from '#lib/components/overlay/details/SharedPoseFields.svelte'
	import { Pose, type PosePatch } from '#lib/math/index.js'
	import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'

	import { type SelectedObstacleShape, shapePatchEdits } from './selectedObstacleShapes'
	import { useObstacleShapeWrites } from './useObstacleShapeWrites'

	interface Props {
		/** The selected shapes. Never empty. */
		shapes: readonly SelectedObstacleShape[]
	}

	const { shapes }: Props = $props()

	const shapeWrites = useObstacleShapeWrites()

	const offsets = $derived(
		shapes.map(({ component, index }) => {
			const entry = obstacleGeometriesOf(component)[index]
			return new Pose().setFromFrame({
				translation: entry?.translation,
				orientation: entry?.orientation,
			})
		})
	)

	let error = $state<string | undefined>()

	/** A shape's offset with `patch` applied, in the spelling the single-shape editor writes. */
	const offsetPatch = (offset: Pose, patch: PosePatch): ObstacleGeometryPatch => ({
		translation: { x: patch.x ?? offset.x, y: patch.y ?? offset.y, z: patch.z ?? offset.z },
		orientation: {
			type: 'ov_degrees',
			value: {
				x: patch.oX ?? offset.oX,
				y: patch.oY ?? offset.oY,
				z: patch.oZ ?? offset.oZ,
				th: patch.theta ?? offset.theta,
			},
		},
	})

	const handleChange = (patches: PosePatch[]) => {
		error = shapeWrites.write(
			shapePatchEdits(
				shapes,
				offsets.map((offset, position) => offsetPatch(offset, patches[position] ?? {}))
			)
		)
	}
</script>

<SharedPoseFields
	poses={offsets}
	editable
	onchange={handleChange}
/>

{#if error}
	<p
		role="alert"
		class="text-danger-dark text-xs"
	>
		{error}
	</p>
{/if}
