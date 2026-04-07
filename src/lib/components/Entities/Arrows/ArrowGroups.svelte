<script lang="ts">
	import type { Entity } from 'koota'

	import { SvelteMap } from 'svelte/reactivity'
	import { Color } from 'three'

	import { STRIDE } from '$lib/buffer'
	import { traits, useWorld } from '$lib/ecs'
	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'

	import Arrows from './Arrows.svelte'

	const world = useWorld()

	const map = new SvelteMap<Entity, InstancedArrows>()

	const colorUtil = new Color()

	const onAdd = (entity: Entity) => {
		const poses = entity.get(traits.Positions)
		const color = entity.get(traits.Color)
		const colors = entity.get(traits.Colors)
		const { headAtPose } = entity.get(traits.Arrows) ?? {}

		if (!poses) return

		const total = poses.length / STRIDE.ARROWS
		const uniformColor = color ? colorUtil.setRGB(color.r, color.g, color.b) : undefined

		const arrows = new InstancedArrows({ count: total, uniformColor })
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
		map.get(entity)?.dispose()
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
