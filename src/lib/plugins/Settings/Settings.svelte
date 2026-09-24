<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { PersistedState } from 'runed'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import { useSettingsTabs } from '$lib/components/overlay/Portals/useSettingsTabs.svelte'
	import WorkspacePortal from '$lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import ControlsSettings from './ControlsSettings.svelte'
	import DebugSettings from './DebugSettings.svelte'
	import FramesSettings from './FramesSettings.svelte'
	import PointcloudSettings from './PointcloudSettings.svelte'
	import SceneSettings from './SceneSettings.svelte'
	import Tabs from './Tabs.svelte'
	import VisionSettings from './VisionSettings.svelte'
	import WeblabSettings from './WeblabSettings.svelte'

	const BUILT_IN_TABS = [
		{ label: 'Scene', component: SceneSettings },
		{ label: 'Controls', component: ControlsSettings },
		{ label: 'Frames', component: FramesSettings },
		{ label: 'Pointclouds', component: PointcloudSettings },
		{ label: 'Vision', component: VisionSettings },
		{ label: 'Debug', component: DebugSettings },
		{ label: 'Weblabs', component: WeblabSettings },
	]

	const { invalidate } = useThrelte()
	const settings = useSettings()
	const settingsTabs = useSettingsTabs()

	// Invalidate the renderer for any settings change
	$effect(() => {
		for (const key in settings.current) {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			settings.current[key as keyof typeof settings.current]
		}

		invalidate()
	})

	const activeTab = new PersistedState('settings-active-tab', BUILT_IN_TABS[0].label)
	const items = $derived([...BUILT_IN_TABS, ...settingsTabs.current])

	// A stored label can name a tab that no longer exists, which would open the
	// panel with nothing selected.
	const defaultTab = $derived(
		items.some((item) => item.label === activeTab.current) ? activeTab.current : items[0].label
	)
</script>

<WorkspacePortal>
	<fieldset>
		<Popover placement="bottom-end">
			{#snippet trigger(triggerProps, { isOpen })}
				<DashboardButton
					{...triggerProps}
					active={isOpen}
					icon="cog"
					description="Settings"
				/>
			{/snippet}

			<!-- Fixed height so the panel doesn't resize as the user moves between tabs. -->
			<div class="font-public-sans h-[500px] w-[460px]">
				<Tabs
					{defaultTab}
					{items}
					onValueChange={(value) => {
						activeTab.current = value
					}}
				/>
			</div>
		</Popover>
	</fieldset>
</WorkspacePortal>
