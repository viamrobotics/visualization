<script lang="ts">
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import WorkspacePortal from '$lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import ResourceWidgetList from './ResourceWidgetList.svelte'
	import ResourceWidgetPanel from './ResourceWidgetPanel.svelte'
	import { useResourceWidgets } from './useResourceWidgets.svelte'

	const environment = useEnvironment()
	const resolved = useResourceWidgets()
</script>

<WorkspacePortal>
	<fieldset>
		<Popover placement="bottom-end">
			{#snippet trigger(triggerProps, { isOpen })}
				<DashboardButton
					{...triggerProps}
					active={isOpen}
					icon="joystick"
					description="Control widgets"
				/>
			{/snippet}

			<div class="font-public-sans max-h-[480px] w-80 overflow-y-auto overscroll-contain p-2">
				<ResourceWidgetList />
			</div>
		</Popover>
	</fieldset>
</WorkspacePortal>

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
