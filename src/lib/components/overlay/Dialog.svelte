<script lang="ts">
	import type { Snippet } from 'svelte'

	import * as dialog from '@zag-js/dialog'
	import { normalizeProps, portal, useMachine } from '@zag-js/svelte'

	interface Props {
		/** Controlled open state. */
		open?: boolean
		title: string
		description?: string
		/** Optional extra body content, rendered between the description and actions. */
		children?: Snippet
		/** Action buttons (e.g. Cancel / Discard). Receives a `close` callback. */
		actions?: Snippet<[{ close: () => void }]>
		/**
		 * `alertdialog` for a confirmation, which demands an explicit response.
		 * `dialog` for one the user fills in, where the alert semantics would have a
		 * screen reader read the whole form as an interruption.
		 */
		role?: 'alertdialog' | 'dialog'
	}

	let {
		open = $bindable(false),
		title,
		description,
		children,
		actions,
		role = 'alertdialog',
	}: Props = $props()

	const id = $props.id()
	const service = useMachine(dialog.machine, () => ({
		id,
		role,
		open,
		onOpenChange: (details: { open: boolean }) => {
			open = details.open
		},
	}))
	const api = $derived(dialog.connect(service, normalizeProps))

	const close = () => api.setOpen(false)
</script>

{#if api.open}
	<div use:portal>
		<div
			{...api.getBackdropProps()}
			class="bg-gray-9/40 fixed inset-0 z-7"
		></div>
		<div
			{...api.getPositionerProps()}
			class="fixed inset-0 z-7 flex items-center justify-center p-4"
		>
			<div
				{...api.getContentProps()}
				class="border-medium flex w-full max-w-sm flex-col gap-3 rounded border bg-white p-4 shadow-sm"
			>
				<h2
					{...api.getTitleProps()}
					class="font-space-grotesk text-heading text-sm font-medium"
				>
					{title}
				</h2>

				{#if description}
					<p
						{...api.getDescriptionProps()}
						class="text-subtle-1 text-sm"
					>
						{description}
					</p>
				{/if}

				{@render children?.()}

				{#if actions}
					<div class="mt-1 flex justify-end gap-2">
						{@render actions({ close })}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
