<script lang="ts">
	import { draggable } from '@neodrag/svelte'
	import { Icon, Select } from '@viamrobotics/prime-core'
	import { CameraStream, useRobotClient, useConnectionStatus } from '@viamrobotics/svelte-sdk'
	import { StreamClient, MachineConnectionEvent } from '@viamrobotics/sdk'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	interface Resolution {
		width: number
		height: number
	}

	const { name, ...rest } = $props<{ name: string }>()

	const settings = useSettings()
	const partID = usePartID()
	const client = useRobotClient(() => partID.current)
	const connectionStatus = useConnectionStatus(() => partID.current)
	const environment = useEnvironment()

	let dragElement = $state.raw<HTMLElement>()
	let aspectRatio = $state.raw<number | undefined>(undefined)
	let fps = $state(0)
	let resolutions = $state<Resolution[]>([])
	let currentResolution = $state<string>('')
	let isLoading = $state(true)
	let error = $state<string | undefined>(undefined)

	let fpsInterval: ReturnType<typeof setInterval> | undefined
	let fpsCounterActive = false

	const cleanup = () => {
		if (fpsInterval) clearInterval(fpsInterval)
		fpsCounterActive = false
	}

	// Cleanup on destroy
	$effect(() => {
		return cleanup
	})

	const onMediaLoad = (e: Event) => {
		const target = e.target as HTMLVideoElement

		// Update aspect ratio
		if (target.videoWidth && target.videoHeight) {
			aspectRatio = target.videoWidth / target.videoHeight
		}

		// Start FPS counter
		if ('requestVideoFrameCallback' in target) {
			if (fpsInterval) clearInterval(fpsInterval)
			fpsCounterActive = false

			let frameCount = 0
			fpsCounterActive = true

			const onFrame = () => {
				if (!fpsCounterActive) return
				frameCount++
				target.requestVideoFrameCallback(onFrame)
			}
			target.requestVideoFrameCallback(onFrame)

			// Update FPS state every 500ms
			fpsInterval = setInterval(() => {
				// FPS = frames / 0.5s = frames * 2
				fps = frameCount * 2
				frameCount = 0
			}, 500)
		}
	}

	// Only create StreamClient when connection is fully established
	let streamClient = $derived(
		client.current && connectionStatus.current === MachineConnectionEvent.CONNECTED
			? new StreamClient(client.current)
			: undefined
	)

	$effect(() => {
		if (streamClient) {
			isLoading = true
			error = undefined

			streamClient
				.getOptions(name)
				.then((options) => {
					resolutions = options.map((opt) => ({ width: opt.width, height: opt.height }))
					isLoading = false
				})
				.catch((error_) => {
					error = error_ instanceof Error ? error_.message : 'Failed to get stream options'
					isLoading = false
				})
		}
	})

	const handleResolutionChange = async (e: Event) => {
		const target = e.target as HTMLSelectElement
		if (!target.value || !streamClient) return

		const [w, h] = target.value.split('x').map(Number)
		if (Number.isNaN(w) || Number.isNaN(h)) return

		try {
			await streamClient.setOptions(name, w, h)
			error = undefined
		} catch (error_) {
			error = error_ instanceof Error ? error_.message : 'Failed to set resolution'
		}
	}
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-4 m-2 flex resize-x flex-col overflow-hidden border text-xs"
	style:width="320px"
	style:height="auto !important"
	use:draggable={{
		bounds: 'body',
		handle: dragElement,
	}}
	{...rest}
>
	<div class="flex h-full min-w-0 flex-col">
		<div class="flex w-full shrink-0 items-center justify-between">
			<div class="border-medium flex w-full items-center gap-1 border-b p-2">
				<button bind:this={dragElement}>
					<Icon name="drag" />
				</button>
				<h3 class="min-w-0 truncate">{name}</h3>
				<div class="flex-1"></div>

				{#if isLoading}
					<span class="text-subtle mr-2">Loading...</span>
				{:else if resolutions.length > 0}
					<div class="mr-2 w-32">
						<Select
							bind:value={currentResolution}
							onchange={handleResolutionChange}
						>
							<option value="">Default</option>
							{#each resolutions as res (`${res.width}x${res.height}`)}
								<option value={`${res.width}x${res.height}`}>{res.width}x{res.height}</option>
							{/each}
						</Select>
					</div>
				{/if}

				<button
					aria-label="close"
					class="hover:text-default"
					onclick={() => {
						const widgets = settings.current.openCameraWidgets[partID.current] || []
						settings.current.openCameraWidgets = {
							...settings.current.openCameraWidgets,
							[partID.current]: widgets.filter((widget) => widget !== name),
						}
					}}
				>
					<Icon
						name="close"
						size="xs"
					/>
				</button>
			</div>
		</div>

		<div
			class="relative min-h-0 w-full flex-1 overflow-hidden bg-black [&_img]:h-full [&_img]:w-full [&_img]:object-fill [&_video]:h-full [&_video]:w-full [&_video]:object-fill"
			style:aspect-ratio={aspectRatio}
		>
			{#if connectionStatus.current === MachineConnectionEvent.CONNECTED}
				{#key environment.current.viewerMode === 'monitor'}
					<CameraStream
						{name}
						partID={partID.current}
						onloadedmetadata={onMediaLoad}
						onload={onMediaLoad}
					/>
				{/key}
			{/if}

			<!-- FPS Pill -->
			{#if fps > 0}
				<div
					class="absolute bottom-2 left-2 z-4 rounded-[3px] bg-black/30 px-1 py-0.5 text-right font-mono text-xs text-white"
				>
					{fps.toFixed(1)}fps
				</div>
			{/if}

			<!-- Error display -->
			{#if error}
				<div
					class="absolute inset-0 flex items-center justify-center bg-black/50 p-2 text-center text-white"
				>
					{error}
				</div>
			{/if}
		</div>
	</div>
</div>
