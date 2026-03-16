<!--
@component

Shows all steps for querying points within a lasso selection
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { T } from '@threlte/core'
	import { Box3, BufferAttribute, BufferGeometry, Vector3 } from 'three'

	import { traits, useTrait } from '$lib/ecs'

	import * as lassoTraits from './traits'

	const box3 = new Box3()
	const min = new Vector3()
	const max = new Vector3()

	interface Props {
		lasso: Entity
	}

	let { lasso }: Props = $props()

	const indices = useTrait(() => lasso, lassoTraits.Indices)
	const positions = useTrait(() => lasso, traits.LinePositions)
	const box = useTrait(() => lasso, lassoTraits.Box)
	const boxes = useTrait(() => lasso, lassoTraits.Boxes)

	const geometry = new BufferGeometry()

	$effect(() => {
		if (indices.current) {
			geometry.setIndex(new BufferAttribute(indices.current, 1))
		}

		if (positions.current) {
			geometry.setAttribute('position', new BufferAttribute(positions.current, 3))
		}
	})
</script>

{#if positions.current && indices.current}
	<T.Mesh>
		<T is={geometry} />
		<T.MeshBasicMaterial
			wireframe
			color="green"
		/>
	</T.Mesh>
{/if}

{#if boxes.current}
	{#each boxes.current as box (box)}
		<T.Box3Helper
			args={[
				new Box3().set(min.set(box.minX, box.minY, 0), max.set(box.maxX, box.maxY, 0)),
				'lightgreen',
			]}
		/>
	{/each}
{/if}

{#if box.current}
	<T.Box3Helper
		args={[
			box3.set(
				min.set(box.current.minX, box.current.minY, 0),
				max.set(box.current.maxX, box.current.maxY, 0)
			),
			'red',
		]}
	/>
{/if}
