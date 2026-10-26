<script lang="ts">
	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { useFrameEntities } from '$lib/hooks/useFrameEntities.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import FramePovView from './FramePovView.svelte'

	interface Props {
		frameName: string
	}

	const { frameName }: Props = $props()

	const settings = useSettings()
	const partID = usePartID()

	const frameEntities = useFrameEntities()
	const entity = $derived(frameEntities.current.get(frameName))

	let isOpen = $state(true)

	$effect(() => {
		if (entity === undefined) {
			isOpen = false
		}
	})

	$effect(() => {
		if (isOpen) return
		const list = settings.current.openFramePovWidgets[partID.current] ?? []
		const next = list.filter((n) => n !== frameName)
		if (next.length === list.length) return
		settings.current.openFramePovWidgets = {
			...settings.current.openFramePovWidgets,
			[partID.current]: next,
		}
	})
</script>

<FloatingPanel
	title={`POV: ${frameName}`}
	bind:isOpen
	defaultSize={{ width: 320, height: 240 }}
	resizable
	bodyClass="bg-transparent"
>
	{#if entity}
		<FramePovView {entity} />
	{/if}
</FloatingPanel>
