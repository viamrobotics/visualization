<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { ClassValue } from 'svelte/elements'

	import { useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { Icon } from '@viamrobotics/prime-core'
	import * as floatingPanel from '@zag-js/floating-panel'
	import { normalizeProps, useMachine } from '@zag-js/svelte'

	interface Props {
		title?: string
		defaultSize?: { width: number; height: number }
		minSize?: { width: number; height: number }
		defaultPosition?: { x: number; y: number }
		exitable?: boolean
		resizable?: boolean
		persistRect?: boolean
		isOpen?: boolean
		bodyClass?: ClassValue
		children: Snippet
		headerPrefix?: Snippet
		headerSuffix?: Snippet
		onPositionChange?: (details: floatingPanel.PositionChangeDetails) => void
		onPositionChangeEnd?: (details: floatingPanel.PositionChangeDetails) => void
		onSizeChange?: (details: floatingPanel.SizeChangeDetails) => void
		onSizeChangeEnd?: (details: floatingPanel.SizeChangeDetails) => void
	}

	let {
		title = '',
		defaultSize = { width: 700, height: 500 },
		defaultPosition,
		exitable = true,
		resizable = false,
		persistRect = true,
		isOpen = $bindable(false),
		bodyClass = 'bg-white',
		headerPrefix,
		headerSuffix,
		children,
		...props
	}: Props = $props()

	const { dom } = useThrelte()

	const id = $props.id()
	const floatingPanelService = useMachine(floatingPanel.machine, () => ({
		id,
		defaultSize,
		defaultPosition: defaultPosition ?? {
			x: dom.clientWidth / 2 - defaultSize.width / 2 + dom.clientLeft,
			y: dom.clientHeight / 2 - defaultSize.width / 2 + dom.clientTop,
		},
		resizable,
		allowOverflow: false,
		strategy: 'absolute' as const,
		persistRect,
		open: isOpen,
		...props,
	}))

	const api = $derived(floatingPanel.connect(floatingPanelService, normalizeProps))
</script>

<Portal id="dom">
	<div
		{...api.getPositionerProps()}
		class="z-5"
	>
		<div
			{...api.getContentProps()}
			class="border-medium flex flex-col border dark:text-black"
		>
			<div
				{...api.getDragTriggerProps()}
				class="sticky shrink-0"
			>
				<div
					{...api.getHeaderProps()}
					class="border-medium flex items-center justify-between gap-2 border-b bg-white p-2"
				>
					<div class="flex min-w-0 items-center gap-1.5">
						{@render headerPrefix?.()}
						<h3
							{...api.getTitleProps()}
							class="text-gray-7 truncate text-xs"
						>
							{title}
						</h3>
					</div>

					<div class="flex min-w-0 shrink-0 items-center gap-3">
						{@render headerSuffix?.()}

						{#if exitable}
							<div
								{...api.getControlProps()}
								class="flex gap-3"
							>
								<button
									aria-label="Close panel"
									onclick={() => (isOpen = false)}
								>
									<Icon name="close" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!--
			Skip rendering the body subtree while collapsed. zag-js controls
			visibility via attributes (the panel chrome stays mounted), but the
			children don't need to react to upstream state when the user can't see them.
			Children mount fresh on open.
		-->
			<div
				{...api.getBodyProps()}
				class={['relative min-h-0 flex-1', bodyClass]}
			>
				{#if isOpen}
					{@render children()}
				{/if}
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
</Portal>
