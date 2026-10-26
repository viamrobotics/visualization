<script lang="ts">
	import type { Component } from 'svelte'

	import { MoreHorizontal } from 'lucide-svelte'

	import Popover from '$lib/components/overlay/Popover.svelte'
	import CollisionsSettings from '$lib/plugins/Settings/CollisionsSettings.svelte'
	import FramesSettings from '$lib/plugins/Settings/FramesSettings.svelte'
	import PointcloudSettings from '$lib/plugins/Settings/PointcloudSettings.svelte'
	import VisionSettings from '$lib/plugins/Settings/VisionSettings.svelte'

	import type { FolderSettingsId } from './treeFolders'

	/** The settings tab that owns each group, so a folder opens its own. */
	const SETTINGS_PANELS: Record<FolderSettingsId, Component> = {
		poses: FramesSettings,
		pointclouds: PointcloudSettings,
		vision: VisionSettings,
		collisions: CollisionsSettings,
	}

	interface Props {
		id: FolderSettingsId
		/** Folder name, so the trigger names the group it opens. */
		label: string
	}

	const { id, label }: Props = $props()

	const SettingsPanel = $derived(SETTINGS_PANELS[id])
</script>

<Popover placement="right-start">
	{#snippet trigger(triggerProps)}
		{@const { onclick, ...triggerRest } = triggerProps}
		<button
			{...triggerRest}
			class="text-gray-6 hover:text-default"
			aria-label="{label} settings"
			onclick={(event) => {
				// The folder row expands on click, and the trigger sits inside it.
				event.stopPropagation()
				onclick?.(event)
			}}
		>
			<MoreHorizontal size={14} />
		</button>
	{/snippet}

	<div class="font-public-sans text-default w-80 p-3">
		<SettingsPanel />
	</div>
</Popover>
