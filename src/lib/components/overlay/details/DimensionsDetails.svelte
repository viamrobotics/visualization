<script lang="ts">
	import { type Entity } from 'koota'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
	const cylinder = useTrait(() => entity, traits.Cylinder)
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label?: string
	value?: number | string
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{typeof value === 'number' ? value.toFixed(2) : (value ?? '-')}
	</div>
{/snippet}

{#if box.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'x',
				ariaLabel: 'box dimensions x value input',
				value: box.current.x,
			})}
			{@render ImmutableField({
				label: 'y',
				ariaLabel: 'box dimensions y value input',
				value: box.current.y,
			})}
			{@render ImmutableField({
				label: 'z',
				ariaLabel: 'box dimensions z value input',
				value: box.current.z,
			})}
		</div>
	</div>
{:else if capsule.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(capsule) (mm)</span>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'capsule dimensions radius value input',
				value: capsule.current.r,
			})}
			{@render ImmutableField({
				label: 'l',
				ariaLabel: 'capsule dimensions length value input',
				value: capsule.current.l,
			})}
		</div>
	</div>
{:else if cylinder.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2"
			>({cylinder.current.capped ? 'cylinder' : 'open cylinder'}) (mm)</span
		>
		<div class="mt-0.5 flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'cylinder dimensions radius value input',
				value: cylinder.current.r,
			})}
			{@render ImmutableField({
				label: 'l',
				ariaLabel: 'cylinder dimensions length value input',
				value: cylinder.current.l,
			})}
		</div>
	</div>
{:else if sphere.current}
	<div>
		<strong class="font-semibold">dimensions (sphere)</strong>
		<div class="flex items-center gap-2">
			{@render ImmutableField({
				label: 'r',
				ariaLabel: 'sphere dimensions radius value',
				value: sphere.current.r,
			})}
		</div>
	</div>
{/if}
