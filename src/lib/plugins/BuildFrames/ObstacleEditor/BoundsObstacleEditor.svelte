<script lang="ts">
	import { NumberField } from '@viamrobotics/prime-controls'
	import { Checkbox, Field, Label } from '@viamrobotics/prime-ui'

	import { generateBoundsGeometries } from '#lib/boundsGeometries.js'
	import { MIN_INTERIOR_MM } from '#lib/boundsObstacleInterior.js'
	import SharedNumberFields from '#lib/components/overlay/details/SharedNumberFields.svelte'
	import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { BOUNDS_FACES, type BoundsFace, type BoundsHint } from '#lib/obstacleAttributes.js'
	import { obstacleEditorHint } from '#lib/obstacleEditorType.js'
	import { withObstacleHint } from '#lib/obstacleVisualizer.js'

	interface Props {
		/** A component that `obstacleEditorType` classed as bounds. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const partConfig = usePartConfig()

	// The steppers stop here. A typed value below it is not positive enough to commit, so it is dropped.
	const MIN_WALL_THICKNESS_MM = 1

	const INTERIOR_FIELDS = [
		{ key: 'x_mm', label: 'X' },
		{ key: 'y_mm', label: 'Y' },
		{ key: 'z_mm', label: 'Z' },
	] as const

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

	// rdk rejects an obstacle with no geometries, so the last wall cannot be left out.
	const includedWallCount = $derived(hint ? BOUNDS_FACES.length - hint.exclude.length : 0)

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

	const handleFaceChange = (face: BoundsFace, included: boolean) => {
		if (!hint) return
		const excluded = new Set(hint.exclude)
		if (included) excluded.delete(face)
		else excluded.add(face)
		commit({ ...hint, exclude: BOUNDS_FACES.filter((entry) => excluded.has(entry)) })
	}
</script>

{#if hint}
	{@const current = hint}
	<div class="flex flex-col gap-2">
		<div>
			<strong class="font-semibold">interior</strong>
			<span class="text-subtle-2">(mm)</span>
			<SharedNumberFields
				aria-label="interior size (mm)"
				fields={INTERIOR_FIELDS}
				values={current}
				min={MIN_INTERIOR_MM}
				onchange={(patch) => commit({ ...current, ...patch })}
			/>
		</div>

		<NumberField
			label="wall thickness (mm)"
			min={MIN_WALL_THICKNESS_MM}
			bind:value={
				() => current.wall_thickness_mm,
				(next) => {
					if (next !== undefined) commit({ ...current, wall_thickness_mm: next })
				}
			}
		/>

		<fieldset class="flex flex-col gap-1 border-0 p-0">
			<legend class="mb-1 p-0 font-semibold">walls</legend>
			{#each BOUNDS_FACES as face (face)}
				{@const isIncluded = !hint.exclude.includes(face)}
				{@const isLastWall = isIncluded && includedWallCount === 1}
				<Field
					label={FACE_LABELS[face]}
					disabled={isLastWall}
					class="text-default flex items-center gap-2"
				>
					<Checkbox
						bind:checked={() => isIncluded, (next) => handleFaceChange(face, next)}
						title={isLastWall ? 'An obstacle needs at least one wall.' : undefined}
					/>
					<Label />
				</Field>
			{/each}
		</fieldset>
	</div>
{/if}
