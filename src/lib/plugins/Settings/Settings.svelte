<script lang="ts">
	import { useThrelte } from '@threlte/core/webgpu'

	import DashboardButton from '#lib/components/overlay/dashboard/Button.svelte'
	import Popover from '#lib/components/overlay/Popover.svelte'
	import { useSettingsTabs } from '#lib/components/overlay/Portals/useSettingsTabs.svelte.js'
	import WorkspacePortal from '#lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { usePersistedStates } from '#lib/hooks/usePersistedStates.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import ControlsSettings from './ControlsSettings.svelte'
	import KeybindingsSettings from './KeybindingsSettings.svelte'
	import PointcloudSettings from './PointcloudSettings.svelte'
	import SceneSettings from './SceneSettings.svelte'
	import Tabs from './Tabs.svelte'
	import WeblabSettings from './WeblabSettings.svelte'

	// Spaced out, so a plugin's tab can sit between two of these. `Machine` puts its tabs at 10, 25, and 30.
	const BUILT_IN_TABS = [
		{ label: 'Scene', component: SceneSettings, order: 0 },
		{ label: 'Pointclouds', component: PointcloudSettings, order: 20 },
		{ label: 'Controls', component: ControlsSettings, order: 40 },
		{ label: 'Keybindings', component: KeybindingsSettings, order: 50 },
		{ label: 'Weblabs', component: WeblabSettings, order: 60 },
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

	const activeTab = usePersistedStates()('settings-active-tab', BUILT_IN_TABS[0].label)
	// `toSorted` is stable, so tabs without an order keep the order their plugins mounted in.
	// Two of those subtract to `NaN`, which `|| 0` turns into a tie.
	const items = $derived(
		[...BUILT_IN_TABS, ...settingsTabs.current].toSorted(
			(a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || 0
		)
	)

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
