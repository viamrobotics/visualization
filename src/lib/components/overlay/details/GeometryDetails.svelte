<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { NumberField } from '@viamrobotics/prime-controls'

	import { traits, useTrait } from '#lib/ecs/index.js'

	import SharedNumberFields from './SharedNumberFields.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)

	const BOX_FIELDS = [
		{ key: 'x', label: 'X' },
		{ key: 'y', label: 'Y' },
		{ key: 'z', label: 'Z' },
	] as const

	// Typing isn't clamped to `min`, and a size of 0 or less is not a shape, so it is never written.
	const isSize = (value: number | undefined): value is number => value !== undefined && value > 0
</script>

{#if box.current}
	{@const current = box.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<SharedNumberFields
			aria-label="box dimensions (mm)"
			fields={BOX_FIELDS}
			values={current}
			min={0}
			onchange={(patch) => {
				if (!Object.values(patch).every((size) => isSize(size))) return
				entity.set(traits.Box, { ...current, ...patch })
				invalidate()
			}}
		/>
	</div>
{:else if sphere.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(sphere) (mm)</span>
		<NumberField
			label="r"
			min={0}
			bind:value={
				() => sphere.current?.r,
				(r) => {
					if (!isSize(r)) return
					entity.set(traits.Sphere, { r })
					invalidate()
				}
			}
		/>
	</div>
{:else if capsule.current}
	{@const current = capsule.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(capsule) (mm)</span>
		<NumberField
			label="r"
			min={0}
			bind:value={
				() => current.r,
				(r) => {
					if (!isSize(r)) return
					entity.set(traits.Capsule, { r, l: current.l })
					invalidate()
				}
			}
		/>
		<NumberField
			label="l"
			min={0}
			bind:value={
				() => current.l,
				(l) => {
					if (!isSize(l)) return
					entity.set(traits.Capsule, { r: current.r, l })
					invalidate()
				}
			}
		/>
	</div>
{/if}
