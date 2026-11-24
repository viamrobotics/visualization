<!--
@component

The offsets of several selected Complex obstacle shapes from their obstacles. A value that differs across them shows as a dash, and an edit writes only the field it changes to every shape.
-->
<script lang="ts">
	import SharedPoseFields from '#lib/components/overlay/details/SharedPoseFields.svelte'
	import { Pose, type PosePatch } from '#lib/math/index.js'
	import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'

	import { obstacleShapeOffsetPatch } from './obstacleShapeOffsetPatch'
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

	const handleChange = (patches: PosePatch[]) => {
		error = shapeWrites.write(
			shapePatchEdits(
				shapes,
				offsets.map((offset, position) => obstacleShapeOffsetPatch(offset, patches[position] ?? {}))
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
