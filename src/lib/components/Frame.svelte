<script module>
	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { Color, type Object3D } from 'three'
	import Geometry from './Geometry.svelte'
	import { colors } from '$lib/color'

	interface Props {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		children?: Snippet<[{ ref: Object3D }]>
	}

	let { uuid, ...rest }: Props = $props()

	const events = useObjectEvents(() => uuid)

	const color = $derived(rest.metadata.color ?? colors.default)
</script>

<Geometry
	{uuid}
	color={`#${colorUtil.set(color).getHexString()}`}
	{...events}
	{...rest}
/>
