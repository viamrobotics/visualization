<script lang="ts">
	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { STRIDE, asColor } from '$lib/buffer'
	import { SvelteMap } from 'svelte/reactivity'
	import { Color } from 'three'
	import Arrows from './Arrows.svelte'

	const world = useWorld()

	const map = new SvelteMap<Entity, InstancedArrows>()
	const colorUtil = new Color()

	const onAdd = (entity: Entity) => {
		const poses = entity.get(traits.Positions)
		const colors = entity.get(traits.Colors)
		const { headAtPose } = entity.get(traits.Arrows) ?? {}

		if (!poses) return

		const total = poses.length / STRIDE.ARROWS
		const alpha = colors && colors.length / STRIDE.COLORS_RGBA === total
		const uniformColor =
			colors && (colors.length === STRIDE.COLORS_RGB || colors.length === STRIDE.COLORS_RGBA)
				? asColor(colors, colorUtil)
				: undefined
		const arrows = new InstancedArrows({ count: total, alpha, uniformColor })
		map.set(entity, arrows)
		arrows.update({ poses, colors, headAtPose })
	}

	/**
	 * TODO: more granular updates here, but this should be fine for now.
	 */
	const onChange = (entity: Entity) => {
		onRemove(entity)
		onAdd(entity)
	}

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
	<Arrows
		{entity}
		{arrows}
	/>
{/each}
