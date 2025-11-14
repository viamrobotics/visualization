<script module>
	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { Color, type Object3D } from 'three'
	import Geometry from './Geometry2.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { colors, darkenColor } from '$lib/color'
	import { WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import type { Entity } from 'koota'
	import { traits } from '$lib/ecs'

	interface Props {
		entity: Entity
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { entity, children }: Props = $props()

	const settings = useSettings()
	const componentModels = use3DModels()
	const selected = useSelected()
	const weblabs = useWeblabs()
	const uuid = $derived(entity.get(traits.UUID))
	const name = $derived(entity.get(traits.Name))
	const entityColor = $derived(entity.get(traits.Color))
	const events = useObjectEvents(() => uuid!)

	const color = $derived(
		entityColor ? colorUtil.set(entityColor.r, entityColor.g, entityColor.b) : colors.default
	)

	const model = $derived.by(() => {
		if (!weblabs.isActive(WEBLABS_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS)) {
			return
		}

		const [componentName, id] = name!.split(':')
		if (!componentName || !id) {
			return
		}
		return componentModels.current?.[componentName]?.[id]
	})
</script>

<Geometry
	{entity}
	{model}
	{children}
	renderMode={settings.current.renderArmModels}
	color={selected.current === uuid
		? `#${darkenColor(color, 75).getHexString()}`
		: `#${colorUtil.set(color).getHexString()}`}
	{...events}
/>
