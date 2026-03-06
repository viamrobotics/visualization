<script lang="ts">
	import type { Snippet } from 'svelte'
	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import { Color, Group, type Object3D } from 'three'
	import Mesh from './Mesh.svelte'
	import { colors, resourceColors } from '$lib/color'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import type { Pose } from '@viamrobotics/sdk'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { Portal, PortalTarget } from '@threlte/extras'

	interface Props {
		entity: Entity
		pose?: Pose
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { entity, pose, children }: Props = $props()

	let ref = $state<Group>()

	const colorUtil = new Color()

	const resourceByName = useResourceByName()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const entityColor = useTrait(() => entity, traits.Color)

	const events = useEntityEvents(() => entity)
	const resourceColor = $derived.by(() => {
		if (!name.current) {
			return undefined
		}
		const subtype = resourceByName.current[name.current]?.subtype
		return resourceColors[subtype as keyof typeof resourceColors]
	})

	const color = $derived.by(() => {
		if (entityColor.current) {
			return colorUtil.set(entityColor.current.r, entityColor.current.g, entityColor.current.b)
		}

		if (resourceColor) {
			return resourceColor
		}

		return colors.default
	})
</script>

<Portal id={parent.current}>
	<Mesh
		bind:ref
		{entity}
		{pose}
		color={`#${colorUtil.set(color).getHexString()}`}
		{...events}
	>
		{#if name.current}
			<PortalTarget id={name.current} />
		{/if}

		{#if ref}
			{@render children?.({ ref })}
		{/if}
	</Mesh>
</Portal>
