<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { ClassValue, HTMLAttributes } from 'svelte/elements'

	import { Portal } from '@threlte/extras'
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tooltip from '@zag-js/tooltip'

	interface Props {
		/**
		 * The element the tooltip describes. Receives the tooltip's id while it is
		 * open — put that on whichever control the description belongs to, so a
		 * screen reader announces it from the focused element and not this wrapper.
		 */
		children: Snippet<[string | undefined]>

		/** Tooltip body. */
		content: Snippet

		/** Preferred side. Flips and slides on its own when it would overflow. */
		placement?: tooltip.Placement

		/** How long the pointer must rest before opening. Focus opens immediately. */
		openDelay?: number

		closeDelay?: number

		/** Keep the tooltip open while the pointer is over its content, so text long enough to read, or worth copying, can be reached. */
		interactive?: boolean

		/** Suppress the tooltip while still rendering its trigger. */
		disabled?: boolean

		/** Classes for the trigger wrapper. */
		triggerClass?: ClassValue
	}

	let {
		children,
		content,
		placement = 'bottom',
		openDelay = 300,
		closeDelay = 150,
		interactive = false,
		disabled = false,
		triggerClass,
	}: Props = $props()

	const id = $props.id()
	const service = useMachine(tooltip.machine, () => ({
		id,
		openDelay,
		closeDelay,
		interactive,
		disabled,
		positioning: { placement, gutter: 6, flip: true, slide: true, overflowPadding: 8 },
	}))

	const api = $derived(tooltip.connect(service, normalizeProps))

	/**
	 * zag types the trigger as a `<button>` because that is the usual shape. Here
	 * it wraps one instead, and the only thing the two disagree on is the
	 * handlers' `currentTarget`, which nothing below reads.
	 */
	const triggerProps = $derived(api.getTriggerProps() as unknown as HTMLAttributes<HTMLSpanElement>)

	const contentId = $derived(api.getContentProps().id ?? undefined)
</script>

<!--
	A plain wrapper, not a button: every trigger here already is an interactive
	element, and nesting one inside a button is invalid markup. zag's Svelte
	adapter maps its focus handlers to `focusin` / `focusout`, which bubble, so
	focusing the real control inside still opens the tooltip.
-->
<span
	{...triggerProps}
	class={['inline-flex items-center', triggerClass]}
>
	{@render children(api.open ? contentId : undefined)}
</span>

{#if api.open}
	<!--
		Portalled to the overlay root so the tooltip escapes the panel that owns
		the trigger. Rendered in place it is positioned against that panel's
		stacking context and clipped by its scroll container.
	-->
	<Portal id="dom">
		<div
			{...api.getPositionerProps()}
			class="[--arrow-background:var(--color-gray-9)] [--arrow-size:8px]"
		>
			<!--
				Content first, arrow second, for two reasons: zag mirrors
				`firstElementChild`'s computed z-index up to the positioner as
				`--z-index` (which its inline style resolves against), and the arrow
				should paint over the content edge it is joined to.
			-->
			<div
				{...api.getContentProps()}
				class="bg-gray-9 z-6 max-w-64 px-2 py-1.5 text-xs text-white"
			>
				{@render content()}
			</div>

			<div {...api.getArrowProps()}>
				<div {...api.getArrowTipProps()}></div>
			</div>
		</div>
	</Portal>
{/if}
