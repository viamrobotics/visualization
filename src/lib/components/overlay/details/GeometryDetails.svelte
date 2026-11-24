<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { NumberField, Point } from '@viamrobotics/prime-controls'

	import { traits, useTrait } from '#lib/ecs/index.js'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
</script>

{#if box.current}
	{@const current = box.current}
	<div>
		<strong class="font-semibold">dimensions</strong>
		<span class="text-subtle-2">(box) (mm)</span>
		<Point
			aria-label="box dimensions (mm)"
			min={0}
			bind:value={
				() => current,
				(next) => {
					entity.set(traits.Box, { x: next.x, y: next.y, z: next.z ?? current.z })
					invalidate()
				}
			}
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
					if (r === undefined) return
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
					if (r === undefined) return
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
					if (l === undefined) return
					entity.set(traits.Capsule, { r: current.r, l })
					invalidate()
				}
			}
		/>
	</div>
{/if}
