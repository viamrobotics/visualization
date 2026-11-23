<script lang="ts">
	import { isInstanceOf, useThrelte } from '@threlte/core/webgpu'
	import { type Entity } from 'koota'
	import { BufferAttribute } from 'three'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { PointCloud } from '#lib/three/PointCloud.js'

	import SectionNotice from './SectionNotice.svelte'
	import { MIXED, MIXED_TEXT, sharedValue } from './sharedValue'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const { scene } = useThrelte()

	const counts = useMappedEntitiesTraits(
		() => entities,
		[traits.Points, traits.BufferGeometry],
		(entity) => {
			const object3d = scene.getObjectByName(entity as unknown as string)
			let cloudGeometry
			if (object3d instanceof PointCloud) cloudGeometry = object3d.cloud
			else if (isInstanceOf(object3d, 'Points')) cloudGeometry = object3d.geometry

			const geometry = entity.get(traits.BufferGeometry)
			let triangles
			// Triangle count is meaningful only for meshes, not point clouds.
			if (geometry && !entity.has(traits.Points)) {
				const index = geometry.getIndex()
				const vertices = index ? index.count : (geometry.getAttribute('position')?.count ?? 0)
				triangles = Math.floor(vertices / 3)
			}

			return {
				points: cloudGeometry
					? (cloudGeometry.getAttribute('position') as BufferAttribute).array.length / 3
					: undefined,
				triangles,
			}
		}
	)

	const pointCounts = $derived(counts.current.map((count) => count.points))
	const triangleCounts = $derived(counts.current.map((count) => count.triangles))

	const format = (values: readonly (number | undefined)[]) => {
		const value = sharedValue(values)
		return value === MIXED || value === undefined
			? MIXED_TEXT
			: new Intl.NumberFormat().format(value)
	}
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

{#snippet SharedCount({
	label,
	values,
	ariaLabel,
	message,
}: {
	label: string
	values: (number | undefined)[]
	ariaLabel: string
	message: string
})}
	{#if values.every((value) => value !== undefined)}
		{@render Count({ label, ariaLabel, value: format(values) })}
	{:else if values.some((value) => value !== undefined)}
		<SectionNotice
			{label}
			{message}
		/>
	{/if}
{/snippet}

{@render SharedCount({
	label: 'points',
	ariaLabel: 'points count',
	values: pointCounts,
	message: 'Not every selected object is a point cloud.',
})}

{@render SharedCount({
	label: 'triangles',
	ariaLabel: 'triangle count',
	values: triangleCounts,
	message: 'Not every selected object is a mesh.',
})}
