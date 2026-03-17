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
		resizable?: boolean
		persistRect?: boolean
		strategy?: 'absolute' | 'fixed'
		isOpen?: boolean
		children: Snippet
	}

	let {
		title = '',
		defaultSize = { width: 700, height: 500 },
		defaultPosition = {
			x: globalThis.innerWidth / 2 - defaultSize.width / 2,
			y: globalThis.innerHeight / 2 - defaultSize.height / 2,
		},
		exitable = true,
		resizable = false,
		persistRect = true,
		isOpen = $bindable(false),
		children,
		...props
	}: Props = $props()

	const id = $props.id()
	const floatingPanelService = useMachine(floatingPanel.machine, () => ({
		id,
		defaultSize,
		defaultPosition,
		resizable,
		allowOverflow: false,
		persistRect,
		open: isOpen,
		...props,
	}))

	const api = $derived(floatingPanel.connect(floatingPanelService, normalizeProps))
</script>

<div
	{...api.getPositionerProps()}
	class="z-5"
>
	<div
		{...api.getContentProps()}
		class="border-medium border-1 bg-white dark:text-black"
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

		{#if resizable}
			<div
				{...api.getResizeTriggerProps({ axis: 'n' })}
				class="h-1.5 max-w-[90%]"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'e' })}
				class="max-h-[90%] w-1.5"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'w' })}
				class="max-h-[90%] w-1.5"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 's' })}
				class="h-1.5 max-w-[90%]"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'ne' })}
				class="size-2.5"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'se' })}
				class="size-2.5"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'sw' })}
				class="size-2.5"
			></div>
			<div
				{...api.getResizeTriggerProps({ axis: 'nw' })}
				class="size-2.5"
			></div>
		{/if}
	</div>
</div>
