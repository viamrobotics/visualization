<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { HTML } from '@threlte/extras'
	import { untrack } from 'svelte'
	import { Group } from 'three'

	import { parseRGB } from '$lib/color'
	import { traits, useTag, useTrait } from '$lib/ecs'

	import { labels } from './labelLayout/labelStore.svelte'

	interface Props {
		entity: Entity
	}

	let { entity }: Props = $props()

	const { invalidate } = useThrelte()

	const matrix = useTrait(() => entity, traits.WorldMatrix)
	const name = useTrait(() => entity, traits.Name)
	const color = useTrait(() => entity, traits.Color)
	const selected = useTag(() => entity, traits.Selected)

	// Through `setRGB`, the same call the mesh renderers use, so the accent
	// matches the shape's rendered color rather than its raw trait floats.
	const accent = $derived(color.current ? parseRGB(color.current).getStyle() : undefined)

	let element = $state.raw<HTMLElement>()

	$effect(() => {
		const el = element

		if (!el) return

		return untrack(() => {
			labels.add(el)
			return () => labels.remove(el)
		})
	})

	// Re-measure when the label text changes (its width drives slot geometry).
	$effect(() => {
		if (name.current) {
			untrack(() => labels.touch())
		}
	})

	let ref = $state<Group>()

	$effect(() => {
		if (matrix.current && ref) {
			ref.matrix.copy(matrix.current)
			ref.updateMatrixWorld()
			invalidate()
		}
	})
</script>

<HTML
	center
	zIndexRange={[3, 0]}
	matrixAutoUpdate={false}
	bind:ref
>
	<div
		class="label relative h-0 w-0"
		bind:this={element}
	>
		<svg class="link pointer-events-none absolute top-0 left-0 overflow-visible">
			<line class="stroke-gray-9 stroke-1" />
		</svg>
		<div
			class="dot border-gray-9 pointer-events-none absolute -top-1 left-0 z-1 h-2 w-2 -translate-1/2 rounded-full border"
		></div>
		<button
			class={[
				'border-gray-9 text absolute z-2 border border-l-4 px-2 py-1 text-xs text-nowrap',
				{
					'bg-gray-9 text-white': selected.current,
					'bg-white': !selected.current,
				},
			]}
			style={accent ? `border-left-color: ${accent}` : undefined}
			onclick={() => {
				entity.add(traits.Selected)
			}}
		>
			{name.current}
		</button>
	</div>
</HTML>
