<script lang="ts">
	import type { Snippet } from 'svelte'

	import Popover from '#lib/components/overlay/Popover.svelte'

	import Button from './Button.svelte'

	interface Props {
		title: string
		active?: boolean
		description?: string
		children: Snippet
	}

	let { title, active = false, description, children }: Props = $props()
</script>

<Popover>
	{#snippet trigger(triggerProps, { isOpen })}
		<Button
			{...triggerProps}
			{active}
			class="rounded-l-none border-l-0"
			icon="chevron-down"
			iconCx="motion-safe:transition-transform {isOpen ? 'rotate-180' : ''}"
			description={description ?? title}
		/>
	{/snippet}

	<div class="flex min-w-48 flex-col">
		<h3 class="border-medium font-public-sans text-gray-7 truncate border-b p-2 text-xs">
			{title}
		</h3>

		<div class="font-public-sans text-default flex flex-col gap-1.5 p-2 text-xs">
			{@render children()}
		</div>
	</div>
</Popover>
