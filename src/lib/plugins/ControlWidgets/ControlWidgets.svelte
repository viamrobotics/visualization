<script lang="ts">
	import SettingsPortal from '#lib/components/overlay/Portals/SettingsPortal.svelte'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'

	import ResourceWidgetList from './ResourceWidgetList.svelte'
	import ResourceWidgetPanel from './ResourceWidgetPanel.svelte'
	import { useResourceWidgets } from './useResourceWidgets.svelte'

	const environment = useEnvironment()
	const resolved = useResourceWidgets()
</script>

<SettingsPortal label="Widgets">
	<ResourceWidgetList />
</SettingsPortal>

<!-- Registry widget panels render only outside XR. -->
{#if !environment.current.isImmersive}
	{#each resolved.current as widget, stackIndex (widget.key)}
		<ResourceWidgetPanel
			resource={widget.resource}
			widgetId={widget.widgetId}
			widgets={widget.widgets}
			title={`${widget.resource.name} · ${widget.label}`}
			{stackIndex}
		/>
	{/each}
{/if}
