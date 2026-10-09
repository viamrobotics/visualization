<script lang="ts">
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		Stepper,
		type StepperChangeEvent,
	} from 'svelte-tweakpane-ui'

	import { generateBoundsGeometries } from '$lib/boundsGeometries'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { BOUNDS_FACES, type BoundsFace, type BoundsHint } from '$lib/obstacleAttributes'
	import { obstacleEditorHint } from '$lib/obstacleEditorType'
	import { withObstacleHint } from '$lib/obstacleVisualizer'

	interface Props {
		/** A component that `obstacleEditorType` classed as bounds. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const partConfig = usePartConfig()

	const FACE_LABELS: Record<BoundsFace, string> = {
		x_max: '+X wall',
		x_min: '−X wall',
		y_max: '+Y wall',
		y_min: '−Y wall',
		floor: 'Floor',
		ceiling: 'Ceiling',
	}

	const hint = $derived.by<BoundsHint | undefined>(() => {
		const resolved = obstacleEditorHint(component)
		return resolved.type === 'bounds' ? resolved : undefined
	})

	const isPositive = (value: number) => Number.isFinite(value) && value > 0

	const commit = (next: BoundsHint) => {
		if (
			![next.x_mm, next.y_mm, next.z_mm, next.wall_thickness_mm].every((value) => isPositive(value))
		) {
			return
		}

		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: generateBoundsGeometries(next) },
			visualizer: withObstacleHint(component, next),
		})
	}

	const handleInteriorChange = (event: PointChangeEvent) => {
		if (!hint || event.detail.origin !== 'internal') return
		const { x, y, z } = event.detail.value as PointValue3dObject
		commit({ ...hint, x_mm: x, y_mm: y, z_mm: z })
	}

	const handleThicknessChange = (event: StepperChangeEvent) => {
		if (!hint || event.detail.origin !== 'internal') return
		commit({ ...hint, wall_thickness_mm: event.detail.value })
	}

	const handleFaceChange = (face: BoundsFace, included: boolean) => {
		if (!hint) return
		const excluded = new Set(hint.exclude)
		if (included) excluded.delete(face)
		else excluded.add(face)
		commit({ ...hint, exclude: BOUNDS_FACES.filter((entry) => excluded.has(entry)) })
	}
</script>

{#if hint}
	<div class="flex flex-col gap-2">
		<div>
			<strong class="font-semibold">interior</strong>
			<span class="text-subtle-2">(mm)</span>
			<div aria-label="mutable interior size">
				<Point
					value={{ x: hint.x_mm, y: hint.y_mm, z: hint.z_mm }}
					min={0}
					on:change={handleInteriorChange}
				/>
			</div>
		</div>

		<div>
			<strong class="font-semibold">wall thickness</strong>
			<span class="text-subtle-2">(mm)</span>
			<div aria-label="mutable wall thickness">
				<Stepper
					label="t"
					value={hint.wall_thickness_mm}
					min={0}
					on:change={handleThicknessChange}
				/>
			</div>
		</div>

		<fieldset class="flex flex-col gap-1 border-0 p-0">
			<legend class="mb-1 p-0 font-semibold">walls</legend>
			{#each BOUNDS_FACES as face (face)}
				<label class="text-default flex items-center gap-2">
					<input
						type="checkbox"
						class="focus-visible:outline-gray-6 focus-visible:outline focus-visible:-outline-offset-1"
						checked={!hint.exclude.includes(face)}
						onchange={(event) => handleFaceChange(face, event.currentTarget.checked)}
					/>
					{FACE_LABELS[face]}
				</label>
			{/each}
		</fieldset>
	</div>
{/if}
