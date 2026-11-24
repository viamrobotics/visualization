<!--
@component

A geometry's type and size. Works for one geometry or a selection that shares a type: a dimension
that differs across the selection shows as a dash, and an edit reports only the field it changed.
-->
<script lang="ts">
	import { Tabs } from '@viamrobotics/prime-controls'

	import type { EditableFrameGeometry } from '#lib/defaultFrameGeometry.js'

	import type { GeometryDimension } from './sharedGeometryDimensions'

	import SharedNumberFields from './SharedNumberFields.svelte'
	import { MIXED, type Shared } from './sharedValue'

	type GeometryType = EditableFrameGeometry['type']

	interface Props {
		type: GeometryType
		/** The type's dimensions. A missing one shows as mixed. */
		dimensions: Partial<Record<GeometryDimension, Shared<number>>>
		/** Whether `None` is offered. An obstacle geometry always has a shape, a frame may have none. */
		includeNone: boolean
		/** Called when the user picks another type. The caller swaps in that type's defaults. */
		ontypechange: (type: GeometryType) => void
		/** Called with the one dimension the user changed. */
		ondimensionchange: (patch: Partial<Record<GeometryDimension, number>>) => void
	}

	const { type, dimensions, includeNone, ontypechange, ondimensionchange }: Props = $props()

	const TYPE_LABELS: Record<GeometryType, string> = {
		none: 'None',
		box: 'Box',
		sphere: 'Sphere',
		capsule: 'Capsule',
	}

	const types = $derived<GeometryType[]>(
		includeNone ? ['none', 'box', 'sphere', 'capsule'] : ['box', 'sphere', 'capsule']
	)

	// The picked tab shows at once, before the caller's write comes back as `type`.
	let selectedType = $derived(type)

	const BOX_FIELDS = [
		{ key: 'x', label: 'X' },
		{ key: 'y', label: 'Y' },
		{ key: 'z', label: 'Z' },
	] as const
	const SPHERE_FIELDS = [{ key: 'r', label: 'R' }] as const
	const CAPSULE_FIELDS = [
		{ key: 'r', label: 'R' },
		{ key: 'l', label: 'L' },
	] as const

	const shown = (key: GeometryDimension): Shared<number> => dimensions[key] ?? MIXED
</script>

<div>
	<strong class="font-semibold">geometry</strong>
	<span class="text-subtle-2">(mm)</span>

	<Tabs
		bind:value={
			() => selectedType,
			(next) => {
				selectedType = next as GeometryType
				ontypechange(selectedType)
			}
		}
	>
		<Tabs.List aria-label="geometry type">
			{#each types as option (option)}
				<Tabs.Trigger value={option}>{TYPE_LABELS[option]}</Tabs.Trigger>
			{/each}
		</Tabs.List>

		{#if type === 'box'}
			<Tabs.Content value="box">
				<SharedNumberFields
					aria-label="box dimensions (mm)"
					fields={BOX_FIELDS}
					values={{ x: shown('x'), y: shown('y'), z: shown('z') }}
					min={0}
					onchange={(patch) => ondimensionchange(patch)}
				/>
			</Tabs.Content>
		{:else if type === 'sphere'}
			<Tabs.Content value="sphere">
				<SharedNumberFields
					aria-label="sphere dimensions (mm)"
					fields={SPHERE_FIELDS}
					values={{ r: shown('r') }}
					min={0}
					onchange={(patch) => ondimensionchange(patch)}
				/>
			</Tabs.Content>
		{:else if type === 'capsule'}
			<Tabs.Content value="capsule">
				<SharedNumberFields
					aria-label="capsule dimensions (mm)"
					fields={CAPSULE_FIELDS}
					values={{ r: shown('r'), l: shown('l') }}
					min={0}
					onchange={(patch) => ondimensionchange(patch)}
				/>
			</Tabs.Content>
		{/if}
	</Tabs>
</div>
