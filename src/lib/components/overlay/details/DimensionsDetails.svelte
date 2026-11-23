<script lang="ts">
	import { type Entity } from 'koota'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import SectionNotice from './SectionNotice.svelte'
	import { formatSharedNumber, type Shared, sharedNumber, sharedValue } from './sharedValue'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const geometries = useMappedEntitiesTraits(
		() => entities,
		[traits.Box, traits.Sphere, traits.Capsule, traits.Cylinder],
		(entity) => {
			const box = entity.get(traits.Box)
			if (box) return { type: 'box', x: box.x, y: box.y, z: box.z } as const

			const capsule = entity.get(traits.Capsule)
			if (capsule) return { type: 'capsule', r: capsule.r, l: capsule.l } as const

			const cylinder = entity.get(traits.Cylinder)
			if (cylinder) {
				return {
					type: 'cylinder',
					r: cylinder.r,
					l: cylinder.l,
					isCapped: cylinder.capped,
				} as const
			}

			const sphere = entity.get(traits.Sphere)
			if (sphere) return { type: 'sphere', r: sphere.r } as const

			return undefined
		}
	)

	const geometryType = $derived(sharedValue(geometries.current.map((geometry) => geometry?.type)))
	const hasAnyGeometry = $derived(geometries.current.some((geometry) => geometry !== undefined))

	/** The named dimension across a selection that shares one geometry type. */
	const dimension = (key: 'x' | 'y' | 'z' | 'r' | 'l'): Shared<number> =>
		sharedNumber(
			geometries.current.map(
				(geometry) =>
					(geometry as Partial<Record<typeof key, number>> | undefined)?.[key] ?? Number.NaN
			)
		)

	// A mixed capped flag reads as plain `cylinder`, which every one of them is.
	const isOpenCylinder = $derived(
		geometries.current.every((geometry) => geometry?.type === 'cylinder' && !geometry.isCapped)
	)
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label: string
	value: Shared<number>
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{formatSharedNumber(value)}
	</div>
{/snippet}

{#if geometryType === 'box'}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'x',
				ariaLabel: 'box dimensions x value input',
				value: dimension('x'),
			})}
			{@render ImmutableField({
				label: 'y',
				ariaLabel: 'box dimensions y value input',
				value: dimension('y'),
			})}
			{@render ImmutableField({
				label: 'z',
				ariaLabel: 'box dimensions z value input',
				value: dimension('z'),
			})}
		</div>
	</div>
{:else if geometryType === 'capsule'}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(capsule) (mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'capsule dimensions radius value input',
				value: dimension('r'),
			})}
			{@render ImmutableField({
				label: 'l',
				ariaLabel: 'capsule dimensions length value input',
				value: dimension('l'),
			})}
		</div>
	</div>
{:else if geometryType === 'cylinder'}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">({isOpenCylinder ? 'open cylinder' : 'cylinder'}) (mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'cylinder dimensions radius value input',
				value: dimension('r'),
			})}
			{@render ImmutableField({
				label: 'l',
				ariaLabel: 'cylinder dimensions length value input',
				value: dimension('l'),
			})}
		</div>
	</div>
{:else if geometryType === 'sphere'}
	<div>
		<strong class="font-semibold">dimensions (sphere)</strong>
		<div class="flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'sphere dimensions radius value',
				value: dimension('r'),
			})}
		</div>
	</div>
{:else if hasAnyGeometry}
	<SectionNotice
		label="dimensions"
		message="The selected objects have different geometry types."
	/>
{/if}
