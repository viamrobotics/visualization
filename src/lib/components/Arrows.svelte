<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { Color } from 'three'
	import { STRIDE } from '$lib/buffer'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { SvelteMap } from 'svelte/reactivity'

	const world = useWorld()

	const map = new SvelteMap<Entity, InstancedArrows>()
	const color = new Color()

	const onAdd = (entity: Entity) => {
		const poses = entity.get(traits.Positions)
		const colors = entity.get(traits.Colors)
		const { headAtPose } = entity.get(traits.Arrows) ?? {}

		if (!poses) return

		const total = poses.length / STRIDE.ARROWS

		const arrows = new InstancedArrows({ count: total })
		map.set(entity, arrows)

		arrows.update({ poses, colors })

		// const origins = new Float32Array(total * 3)
		// const directions = new Float32Array(total * 3)

		// for (let i = 0, pi = 0, l = poses.length; pi <= l; pi += STRIDE.ARROWS, i += 3) {
		// 	origins[i + 0] = poses[pi + 0] * 0.001
		// 	origins[i + 1] = poses[pi + 1] * 0.001
		// 	origins[i + 2] = poses[pi + 2] * 0.001

		// 	directions[i + 0] = poses[pi + 3]
		// 	directions[i + 1] = poses[pi + 4]
		// 	directions[i + 2] = poses[pi + 5]

		// 	arrows.update({ origins, directions, colors })
		// }
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

	const events = useObjectEvents(() => undefined)
</script>

{#each map as [entity, arrows] (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<T
			is={arrows}
			dispose={false}
			bvh={{ enabled: false }}
			{...events}
		/>
	</Portal>
{/each}
