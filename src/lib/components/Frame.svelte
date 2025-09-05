<script module>
	import { Color, type Object3D } from 'three'

	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import Geometry from './Geometry.svelte'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { colors, darkenColor } from '$lib/color'

	interface Props {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { uuid, ...rest }: Props = $props()

	const selected = useSelected()
	const events = useObjectEvents(() => uuid)

	const color = $derived(rest.metadata.color ?? colors.default)
</script>

<Geometry
	{uuid}
	color={selected.current === uuid
		? `#${darkenColor(color, 75).getHexString()}`
		: `#${colorUtil.set(color).getHexString()}`}
	{...events}
	{...rest}
/>
