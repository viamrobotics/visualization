<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLButtonAttributes } from 'svelte/elements'

	import * as popover from '@zag-js/popover'
	import { normalizeProps, portal, useMachine } from '@zag-js/svelte'

	interface Props {
		trigger: Snippet<[HTMLButtonAttributes, { isOpen: boolean }]>
		children: Snippet<[{ close: () => void }]>

		placement?: popover.Placement
		onOpenChange?: (open: boolean) => void
	}

	let { children, trigger, placement = 'bottom', onOpenChange }: Props = $props()

	const id = $props.id()
	const service = useMachine(popover.machine, () => ({
		id,
		positioning: { placement, gutter: 6, flip: true, slide: true, overflowPadding: 8 },
		autoFocus: false,
		onOpenChange: (details) => onOpenChange?.(details.open),
	}))
	const api = $derived(popover.connect(service, normalizeProps))

	const close = () => api.setOpen(false)
</script>

{@render trigger(api.getTriggerProps(), { isOpen: api.open })}

<div
	use:portal={{ disabled: !api.portalled }}
	{...api.getPositionerProps()}
	class="[--arrow-background:var(--color-white)] [--arrow-size:8px]"
>
	<!--
		zag's popper writes --available-height on the positioner. The 100vh fallback
		covers the first frame, before positioning has run.
	-->
	<div
		{...api.getContentProps()}
		class="border-medium z-6 max-h-[var(--available-height,100vh)] overflow-y-auto overscroll-contain border bg-white shadow-sm"
	>
		<!--
			zag keeps the content element mounted and toggles `hidden`. Gate the subtree
			so panel contents stop reacting to upstream state while the user can't see them.
		-->
		{#if api.open}
			{@render children({ close })}
		{/if}
	</div>

	{#if api.open}
		<div {...api.getArrowProps()}>
			<div
				{...api.getArrowTipProps()}
				class="border-medium border-t border-l"
			></div>
		</div>
	{/if}
</div>
