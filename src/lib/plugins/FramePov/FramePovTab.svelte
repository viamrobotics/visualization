<script lang="ts">
	import { type Entity } from 'koota'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import FramePovView from './FramePovView.svelte'

	interface Props {
		entity: Entity
		frameName: string
	}

	const { entity, frameName }: Props = $props()

	const settings = useSettings()
	const partID = usePartID()

	const openWidget = () => {
		const list = settings.current.openFramePovWidgets[partID.current] ?? []
		if (list.includes(frameName)) return
		settings.current.openFramePovWidgets = {
			...settings.current.openFramePovWidgets,
			[partID.current]: [...list, frameName],
		}
	}
</script>

<div class="relative aspect-4/3 w-full">
	<FramePovView {entity} />

	<div class="absolute top-1 left-1 z-1">
		<Button
			icon="open-in-new"
			description="Pop out view"
			tooltipLocation="right"
			onclick={openWidget}
		/>
	</div>
</div>
