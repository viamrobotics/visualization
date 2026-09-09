<script lang="ts">
	import type { Snippet } from 'svelte'

	import { type IconName } from '@viamrobotics/prime-core'
	import { Pane } from 'svelte-tweakpane-ui'

	import Popover from '$lib/components/overlay/Popover.svelte'

	import Button from './Button.svelte'

	interface Props {
		title: string
		active?: boolean
		description?: string
		/**
		 * Render children directly instead of inside a tweakpane `Pane`. The `Pane` exists
		 * for panes made of tweakpane controls; it re-parents its children, which breaks
		 * the Svelte context chain, so anything inside one has to take what it needs as
		 * props. Pass this for a pane of ordinary markup.
		 */
		plain?: boolean
		/**
		 * The trigger's icon. Defaults to a chevron, which suits a pane sitting beside
		 * the control it configures. Pass an icon of your own where the pane is the
		 * primary affordance rather than an adjunct to a neighbouring button.
		 */
		icon?: IconName | 'ruler' | 'mouse-pointer' | 'shapes' | 'hammer' | 'move-3d'
		/**
		 * Trigger classes. The default squares off the left edge so the pane butts
		 * against the button it configures. Override it where the pane stands alone.
		 */
		class?: string
		children: Snippet
	}

	let {
		title,
		active = false,
		description,
		plain = false,
		icon = 'chevron-down',
		class: className = 'rounded-l-none border-l-0',
		children,
	}: Props = $props()
</script>

<Popover>
	{#snippet trigger(triggerProps, { isOpen })}
		<Button
			{...triggerProps}
			{active}
			class={className}
			{icon}
			iconCx={icon === 'chevron-down'
				? `motion-safe:transition-transform ${isOpen ? 'rotate-180' : ''}`
				: undefined}
			description={description ?? title}
		/>
	{/snippet}

	<div class="flex min-w-48 flex-col">
		<h3 class="border-medium font-public-sans text-gray-7 truncate border-b p-2 text-xs">
			{title}
		</h3>

		<div class="px-1">
			{#if plain}
				{@render children()}
			{:else}
				<Pane position="inline">
					{@render children()}
				</Pane>
			{/if}
		</div>
	</div>
</Popover>
