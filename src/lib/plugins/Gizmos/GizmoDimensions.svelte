<!--
@component

Editable dimension rows for a box, sphere, or capsule gizmo, in mm. Writes the
geometry trait directly, matching `PlaneDetails`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Slider, type SliderChangeEvent } from 'svelte-tweakpane-ui'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)

	const handleBoxChange = (axis: 'x' | 'y' | 'z') => (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const current = box.current
		if (!current) return
		entity.set(traits.Box, { ...current, [axis]: event.detail.value })
		invalidate()
	}

	const handleSphereRadiusChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const current = sphere.current
		if (!current) return
		entity.set(traits.Sphere, { r: event.detail.value })
		invalidate()
	}

	const handleCapsuleChange = (field: 'l' | 'r') => (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const current = capsule.current
		if (!current) return
		entity.set(traits.Capsule, { ...current, [field]: event.detail.value })
		invalidate()
	}
</script>

{#if box.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<div
			class="font-roboto-mono mt-0.5 flex items-center gap-2"
			role="group"
			aria-label="mutable box dimensions"
		>
			<Slider
				label="x"
				value={box.current.x}
				min={0}
				on:change={handleBoxChange('x')}
			/>
			<Slider
				label="y"
				value={box.current.y}
				min={0}
				on:change={handleBoxChange('y')}
			/>
			<Slider
				label="z"
				value={box.current.z}
				min={0}
				on:change={handleBoxChange('z')}
			/>
		</div>
	</div>
{:else if capsule.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(capsule) (mm)</span>
		<div
			class="font-roboto-mono mt-0.5 flex items-center gap-2"
			role="group"
			aria-label="mutable capsule dimensions"
		>
			<Slider
				label="r"
				value={capsule.current.r}
				min={0}
				on:change={handleCapsuleChange('r')}
			/>
			<Slider
				label="l"
				value={capsule.current.l}
				min={0}
				on:change={handleCapsuleChange('l')}
			/>
		</div>
	</div>
{:else if sphere.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(sphere) (mm)</span>
		<div
			class="font-roboto-mono mt-0.5 flex items-center gap-2"
			role="group"
			aria-label="mutable sphere dimensions"
		>
			<Slider
				label="r"
				value={sphere.current.r}
				min={0}
				on:change={handleSphereRadiusChange}
			/>
		</div>
	</div>
{/if}
