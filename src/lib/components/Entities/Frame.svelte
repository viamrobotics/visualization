<!--
@component

Renders a Viam Frame object
-->
<script module>
	import { Color } from 'three'

	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useThrelte } from '@threlte/core'
	import { Portal, PortalTarget } from '@threlte/extras'
	import { Group, type Object3D } from 'three'

	import { asColor } from '$lib/buffer'
	import { colors, resourceColors } from '$lib/color'
	import { traits, useTrait } from '$lib/ecs'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { poseToObject3d } from '$lib/transform'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import Mesh from './Mesh.svelte'

	interface Props {
		entity: Entity
		pose?: Pose
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { entity, pose, children }: Props = $props()

	const { invalidate } = useThrelte()
	const resourceByName = useResourceByName()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const rawColors = useTrait(() => entity, traits.Colors)
	const entityColor = useTrait(() => entity, traits.Color)
	const entityPose = useTrait(() => entity, traits.Pose)
	const center = useTrait(() => entity, traits.Center)

	const events = useEntityEvents(() => entity)

	const color = $derived.by(() => {
		if (rawColors.current) {
			return `#${asColor(rawColors.current, colorUtil).getHexString()}`
		}

		if (entityColor.current) {
			return `#${colorUtil.setRGB(entityColor.current.r, entityColor.current.g, entityColor.current.b).getHexString()}`
		}

		const subtype = resourceByName.current[name.current ?? '']?.subtype
		const resourceColor = resourceColors[subtype as keyof typeof resourceColors]

		if (resourceColor) {
			return resourceColor
		}

		return colors.default
	})

	const group = new Group()

	const resolvedPose = $derived(pose ?? entityPose.current)
	$effect.pre(() => {
		if (resolvedPose) {
			poseToObject3d(resolvedPose, group)
			invalidate()
		}
	})
</script>

<Portal id={parent.current}>
	<T is={group}>
		<Mesh
			{entity}
			{color}
			{...events}
			center={center.current}
		/>

		{#if name.current}
			<PortalTarget id={name.current} />
		{/if}

		{@render children?.({ ref: group })}
	</T>
</Portal>
