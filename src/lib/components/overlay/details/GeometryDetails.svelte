<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import {
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		Slider,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'

	import { traits, useTrait } from '#lib/ecs/index.js'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)

	const handleBoxChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue3dObject
		entity.set(traits.Box, { x: next.x, y: next.y, z: next.z })
		invalidate()
	}

	const handleSphereRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		entity.set(traits.Sphere, { r: event.detail.value })
		invalidate()
	}

	const handleCapsuleRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const current = capsule.current
		if (!current) return
		entity.set(traits.Capsule, { r: event.detail.value, l: current.l })
		invalidate()
	}

	const handleCapsuleLChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const current = capsule.current
		if (!current) return
		entity.set(traits.Capsule, { r: current.r, l: event.detail.value })
		invalidate()
	}
</script>

{#if box.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<div aria-label="mutable box dimensions">
			<Point
				value={{
					x: box.current.x,
					y: box.current.y,
					z: box.current.z,
				}}
				min={0}
				on:change={handleBoxChange}
			/>
		</div>
	</div>
{:else if sphere.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(sphere) (mm)</span>
		<div aria-label="mutable sphere dimensions">
			<Slider
				label="r"
				value={sphere.current.r}
				min={0}
				on:change={handleSphereRChange}
			/>
		</div>
	</div>
{:else if capsule.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(capsule) (mm)</span>
		<div aria-label="mutable capsule dimensions">
			<Slider
				label="r"
				value={capsule.current.r}
				min={0}
				on:change={handleCapsuleRChange}
			/>
			<Slider
				label="l"
				value={capsule.current.l}
				min={0}
				on:change={handleCapsuleLChange}
			/>
		</div>
	</div>
{/if}
