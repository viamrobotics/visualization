<script lang="ts">
	import { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { STRIDE } from '$lib/buffer'
	import { SvelteMap } from 'svelte/reactivity'
	import { Color } from 'three'
	import Arrows from './Arrows.svelte'

	const world = useWorld()

	const map = new SvelteMap<Entity, InstancedArrows>()

	const onAdd = (entity: Entity) => {
		const poses = entity.get(traits.Positions)
		const colors = entity.get(traits.Colors)
		const color = entity.get(traits.Color)
		const { headAtPose } = entity.get(traits.Arrows) ?? {}

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/a63a6a05-e8a1-404f-93cb-508b8525b6ee', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'ArrowGroups.svelte:20',
				message: 'onAdd callback',
				data: {
					hasColor: !!color,
					colorValue: color,
					hasColors: !!colors,
					colorsLength: colors?.length,
				},
				hypothesisId: 'G',
				timestamp: Date.now(),
			}),
		}).catch(() => {})
		// #endregion

		if (!poses) return

		const total = poses.length / STRIDE.ARROWS
		const alpha = colors && colors.length / STRIDE.COLORS_RGBA === total
		let uniformColor: Color | undefined
		if (color) {
			uniformColor = new Color(color.r, color.g, color.b)
		} else if (colors && (colors.length === 3 || colors.length === 4)) {
			uniformColor = new Color(colors[0] / 255, colors[1] / 255, colors[2] / 255)
		}

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/a63a6a05-e8a1-404f-93cb-508b8525b6ee', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'ArrowGroups.svelte:38',
				message: 'Creating InstancedArrows',
				data: {
					uniformColor: uniformColor
						? { r: uniformColor.r, g: uniformColor.g, b: uniformColor.b }
						: null,
				},
				hypothesisId: 'G',
				timestamp: Date.now(),
			}),
		}).catch(() => {})
		// #endregion

		const arrows = new InstancedArrows({ count: total, alpha, uniformColor })
		map.set(entity, arrows)
		arrows.update({ poses, colors, headAtPose })
	}

	/**
	 * TODO: more granular updates here, but this should be fine for now.
	 */
	const onChange = (entity: Entity) => {
		// #region agent log
		const oldArrows = map.get(entity);
		fetch('http://127.0.0.1:7242/ingest/a63a6a05-e8a1-404f-93cb-508b8525b6ee',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ArrowGroups.svelte:51',message:'onChange triggered',data:{hadOldArrows:!!oldArrows,entityName:entity.get(traits.Name)},hypothesisId:'H',timestamp:Date.now()})}).catch(()=>{});
		// #endregion
		onRemove(entity)
		onAdd(entity)
	}

	const onRemove = (entity: Entity) => {
		// #region agent log
		const arrows = map.get(entity);
		fetch('http://127.0.0.1:7242/ingest/a63a6a05-e8a1-404f-93cb-508b8525b6ee',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ArrowGroups.svelte:61',message:'onRemove called',data:{hadArrows:!!arrows,entityName:entity.get(traits.Name)},hypothesisId:'H',timestamp:Date.now()})}).catch(()=>{});
		// #endregion
		map.delete(entity)
	}

	$effect(() => {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/a63a6a05-e8a1-404f-93cb-508b8525b6ee',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ArrowGroups.svelte:76',message:'ArrowGroups effect initialized',data:{currentMapSize:map.size},hypothesisId:'J',timestamp:Date.now()})}).catch(()=>{});
		// #endregion
		
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
