<script lang="ts">
	import FloatingPanel from '#lib/components/overlay/FloatingPanel.svelte'
	import { useFrameEntities } from '#lib/hooks/useFrameEntities.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import FramePovView from './FramePovView.svelte'

	interface Props {
		frameName: string
	}

	const { frameName }: Props = $props()

	const settings = useSettings()
	const partID = usePartID()

	const frameEntities = useFrameEntities()
	const entity = $derived(frameEntities.current.get(frameName))

	// Stays open while its frame is missing: on reload, settings restore before the frames arrive.
	let isOpen = $state(true)

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
	{:else}
		<p class="text-subtle-1 bg-light flex h-full items-center justify-center p-2 text-xs">
			Waiting for frame "{frameName}"…
		</p>
	{/if}
</FloatingPanel>
