<script module>
	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { Color, type Object3D } from 'three'
	import Geometry from './Geometry.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { colors, darkenColor } from '$lib/color'
	import { WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'

	interface Props {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { uuid, name, ...rest }: Props = $props()

	const settings = useSettings()
	const componentModels = use3DModels()
	const selected = useSelected()
	const weblabs = useWeblabs()
	const events = useObjectEvents(() => uuid)

	const color = $derived(rest.metadata.color ?? colors.default)

	const model = $derived.by(() => {
		if (!weblabs.isActive(WEBLABS_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS)) {
			return
		}

		const [componentName, id] = name.split(':')
		if (!componentName || !id) {
			return
		}
		return componentModels.current?.[componentName]?.[id]
	})
</script>

<Geometry
	{uuid}
	{name}
	{model}
	renderMode={settings.current.renderArmModels}
	color={selected.current === uuid
		? `#${darkenColor(color, 75).getHexString()}`
		: `#${colorUtil.set(color).getHexString()}`}
	{...events}
	{...rest}
/>
