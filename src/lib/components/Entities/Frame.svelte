<script lang="ts">
	import type { Snippet } from 'svelte'
	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import { Color, Group, type Object3D } from 'three'
	import Geometry from './Geometry.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { defaultColor, darkenColor, resourceColors } from '$lib/color'
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

	const settings = useSettings()
	const componentModels = use3DModels()
	const selectedEntity = useSelectedEntity()
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
		if (!entityColor.current) return resourceColor ?? defaultColor
		return colorUtil.setRGB(entityColor.current.r, entityColor.current.g, entityColor.current.b)
	})

	const model = $derived.by(() => {
		if (!name.current) {
			return
		}

		const [componentName, id] = name.current.split(':')
		if (!componentName || !id) {
			return
		}
		return componentModels.current?.[componentName]?.[id].clone()
	})
</script>

<Portal id={parent.current}>
	<Geometry
		bind:ref
		{entity}
		{model}
		{pose}
		renderMode={settings.current.renderArmModels}
		color={selectedEntity.current === entity
			? `#${darkenColor(color, 75).getHexString()}`
			: `#${colorUtil.set(color).getHexString()}`}
		{...events}
	>
		{#if name.current}
			<PortalTarget id={name.current} />
		{/if}

		{#if ref}
			{@render children?.({ ref })}
		{/if}
	</Geometry>
</Portal>
