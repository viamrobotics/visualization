<script lang="ts">
	import { MoreHorizontal } from 'lucide-svelte'

	import Popover from '#lib/components/overlay/Popover.svelte'
	import DomPortalTarget from '#lib/components/overlay/Portals/DomPortalTarget.svelte'
	import { folderSettingsPortalId } from '#lib/ecs/index.js'

	interface Props {
		/** `traits.Folder.id`. The folder's owner moves its settings panel in under this id. */
		folderId: string
		/** Folder name, so the trigger names the group it opens. */
		label: string
	}

	const { folderId, label }: Props = $props()
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
		<DomPortalTarget id={folderSettingsPortalId(folderId)} />
	</div>
</Popover>
