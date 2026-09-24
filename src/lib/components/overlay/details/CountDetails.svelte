<script lang="ts">
	import { isInstanceOf, useThrelte } from '@threlte/core'
	import { type Entity } from 'koota'
	import { BufferAttribute } from 'three'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { scene } = useThrelte()

	const object3d = $derived(scene.getObjectByName(entity as unknown as string))

	const points = useTrait(() => entity, traits.Points)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)

	const triangleCount = $derived.by(() => {
		const geometry = bufferGeometry.current
		// Triangle count is meaningful only for meshes, not point clouds.
		if (!geometry || points.current) return
		const index = geometry.getIndex()
		const vertices = index ? index.count : (geometry.getAttribute('position')?.count ?? 0)
		return Math.floor(vertices / 3)
	})

	const format = (value: number) => new Intl.NumberFormat().format(value)
</script>

{#snippet Count({ label, value, ariaLabel }: { label: string; value: string; ariaLabel: string })}
	<div>
		<strong class="font-semibold">{label}</strong>
		<div>
			<span
				class="text-subtle-2"
				aria-label={`immutable ${ariaLabel}`}
			>
				count
			</span>

			{value}
		</div>
	</div>
{/snippet}

{#if isInstanceOf(object3d, 'Points')}
	{@render Count({
		label: 'points',
		ariaLabel: 'points count',
		value: format((object3d.geometry.getAttribute('position') as BufferAttribute).array.length / 3),
	})}
{/if}

{#if triangleCount !== undefined}
	{@render Count({
		label: 'triangles',
		ariaLabel: 'triangle count',
		value: format(triangleCount),
	})}
{/if}
