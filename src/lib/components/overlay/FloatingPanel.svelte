<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Icon } from '@viamrobotics/prime-core'

	import * as floatingPanel from '@zag-js/floating-panel'
	import { normalizeProps, useMachine } from '@zag-js/svelte'

	interface Props {
		title?: string
		defaultSize?: { width: number; height: number }
		defaultPosition?: { x: number; y: number }
		exitable?: boolean
		isOpen?: boolean
		children: Snippet
	}

	let {
		title = '',
		defaultSize = { width: 700, height: 500 },
		defaultPosition,
		exitable = true,
		isOpen = $bindable(false),
		children,
	}: Props = $props()

	const id = $props.id()
	const floatingPanelService = useMachine(floatingPanel.machine, () => ({
		id,
		defaultSize,
		defaultPosition,
		resizable: false,
		allowOverflow: false,
		open: isOpen,
	}))

	const api = $derived(floatingPanel.connect(floatingPanelService, normalizeProps))
</script>

<div
	{...api.getPositionerProps()}
	class="z-5"
>
	<div
		{...api.getContentProps()}
		class="border-medium border-1 bg-white"
	>
		<div
			{...api.getDragTriggerProps()}
			class="sticky"
		>
			<div
				{...api.getHeaderProps()}
				class="border-medium flex justify-between border-b p-2"
			>
				<p
					{...api.getTitleProps()}
					class="text-gray-7 text-xs"
				>
					{title}
				</p>

				{#if exitable}
					<div
						{...api.getControlProps()}
						class="flex gap-3"
					>
						<button
							aria-label="Close connection configs panel"
							onclick={() => (isOpen = false)}
						>
							<Icon name="close" />
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div
			{...api.getBodyProps()}
			class="relative h-[calc(100%-33px)]"
		>
			{@render children()}
		</div>
	</div>
</div>
