<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { ClassValue } from 'svelte/elements'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Portal } from '@threlte/extras/webgpu'
	import { Icon } from '@viamrobotics/prime-core'
	import * as floatingPanel from '@zag-js/floating-panel'
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import { untrack } from 'svelte'

	import { clampPanelPosition } from '$lib/components/overlay/clampPanelPosition'

	interface Props {
		title?: string
		defaultSize?: { width: number; height: number }
		/** Pass a stable object reference: the size is re-applied whenever it changes, discarding a manual resize.*/
		size?: { width: number; height: number }
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
		size,
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

	// Stays undefined unless the caller opted in, which leaves the machine uncontrolled and every
	// other panel behaving exactly as before.
	let currentSize = $state(untrack(() => size))

	// Not derived state: `size` is a push from the caller and a resize drag is a push from the
	// machine, so whichever moved last wins — an assignment, not a computation.
	$effect(() => {
		if (size) currentSize = size
	})

	// Mirrors the machine's size while it is uncontrolled. Reading it from `api` instead would make
	// the clamped position depend on the machine that consumes it.
	let uncontrolledSize = $state(untrack(() => defaultSize))
	const panelSize = $derived(currentSize ?? uncontrolledSize)

	const measureScene = () => ({ width: dom.clientWidth, height: dom.clientHeight })
	let sceneSize = $state(measureScene())
	$effect(() => {
		const observer = new ResizeObserver(() => (sceneSize = measureScene()))
		observer.observe(dom)
		return () => observer.disconnect()
	})

	const initialPosition = untrack(
		() =>
			defaultPosition ?? {
				x: dom.clientWidth / 2 - defaultSize.width / 2 + dom.clientLeft,
				y: dom.clientHeight / 2 - defaultSize.height / 2 + dom.clientTop,
			}
	)

	let requestedPosition = $state(initialPosition)
	const position = $derived(clampPanelPosition(requestedPosition, panelSize, sceneSize))

	const floatingPanelService = useMachine(floatingPanel.machine, () => ({
		id,
		defaultSize,
		size: currentSize,
		defaultPosition: initialPosition,
		position,
		resizable,
		allowOverflow: false,
		strategy: 'absolute' as const,
		persistRect,
		open: isOpen,
		...props,
		onPositionChange: (details: floatingPanel.PositionChangeDetails) => {
			requestedPosition = details.position
			props.onPositionChange?.({ position })
		},
		onSizeChange: (details: floatingPanel.SizeChangeDetails) => {
			// Controlled panels have to adopt the drag's own result, or a resize snaps straight back.
			if (currentSize) currentSize = details.size
			uncontrolledSize = details.size
			props.onSizeChange?.(details)
		},
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
			<!--
				zag maximizes the panel on a double click of its header, with no prop to
				turn it off. Dropped: a double click here is usually a fast second click
				on a header control, and the panel that swallows the viewport offers
				nothing to undo it with.
			-->
			<div
				{...api.getDragTriggerProps()}
				ondblclick={null}
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

					<div class="flex shrink-0 items-center gap-3">
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
