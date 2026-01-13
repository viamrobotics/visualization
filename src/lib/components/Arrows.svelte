<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { STRIDE } from '$lib/buffer'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { Color } from 'three'

	const world = useWorld()

	const map = new SvelteMap<Entity, InstancedArrows>()

	const onAdd = (entity: Entity) => {
		const poses = entity.get(traits.Positions)
		const colors = entity.get(traits.Colors)
		const { headAtPose } = entity.get(traits.Arrows) ?? {}

		if (!poses) return

		const total = poses.length / STRIDE.ARROWS
		const alpha = colors && colors.length / STRIDE.COLORS_RGBA === total
		const uniformColor =
			colors && (colors.length === 3 || colors.length === 4)
				? new Color(colors[0], colors[1], colors[2])
				: undefined

		const arrows = new InstancedArrows({ count: total, alpha, uniformColor })
		map.set(entity, arrows)
		arrows.update({ poses, colors, headAtPose })
	}

	const onChange = (entity: Entity) => {}

	const onRemove = (entity: Entity) => {
		map.delete(entity)
	}

	$effect(() => {
		const unsubAdd = world.onAdd(traits.Arrows, onAdd)
		const unsubRemove = world.onRemove(traits.Arrows, onRemove)
		const unsubPoseChange = world.onChange(traits.Arrows, onChange)

		return () => {
			unsubAdd()
			unsubRemove()
			unsubPoseChange()
		}
	})
</script>

{#each map as [entity, arrows] (entity)}
	{@const events = useObjectEvents(() => entity)}
	<Portal id={entity.get(traits.Parent)}>
		<T
			is={arrows}
			dispose={false}
			bvh={{ enabled: false }}
			{...events}
		/>
	</Portal>
{/each}
