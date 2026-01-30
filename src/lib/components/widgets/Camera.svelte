<script lang="ts">
	import { draggable } from '@neodrag/svelte'
	import { Icon, Select } from '@viamrobotics/prime-core'
	import { CameraStream, useRobotClient } from '@viamrobotics/svelte-sdk'
	import { StreamClient } from '@viamrobotics/sdk'

	// Type definitions for stream resolution
	interface Resolution {
		width: number
		height: number
	}

	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	const { name, ...rest } = $props<{ name: string }>()

	const settings = useSettings()
	const partID = usePartID()
	const client = useRobotClient(() => partID.current)
	const environment = useEnvironment()

	let dragElement = $state.raw<HTMLElement>()
	let aspectRatio = $state.raw<number | undefined>(undefined)
	let fps = $state(0)
	let resolutions = $state<Resolution[]>([])
	let currentResolution = $state<string>('')

	let fpsInterval: ReturnType<typeof setInterval> | undefined

	// Cleanup interval on destroy
	$effect(() => {
		return () => {
			if (fpsInterval) clearInterval(fpsInterval)
		}
	})

	const onMediaLoad = async (e: Event) => {
		const target = e.target as HTMLVideoElement

		// Update aspect ratio
		if (target.videoWidth && target.videoHeight) {
			aspectRatio = target.videoWidth / target.videoHeight
		}

		// Start FPS counter
		if ('requestVideoFrameCallback' in target) {
			if (fpsInterval) clearInterval(fpsInterval)

			let frameCount = 0
			// Use rVFC just to count frames
			const onFrame = () => {
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

	$effect(() => {
		if (client.current) {
			const streamClient = new StreamClient(client.current)
			streamClient
				.getOptions(name)
				.then((options) => {
					resolutions = options.map((opt) => ({ width: opt.width, height: opt.height }))
					// Set initial selection if available but don't force it automatically unless necessary?
					// Actually, forcing the first option (often lowest or sensible default) might solve the lag immediately.
					// But let's just let the user choose.
					if (resolutions.length > 0) {
						console.log(`Available resolutions for ${name}:`, resolutions)
					}
				})
				.catch((e) => console.error('Failed to get stream options', e))
		}
	})

	const handleResolutionChange = async (e: Event) => {
		const target = e.target as HTMLSelectElement
		if (!target.value || !client.current) return

		const [w, h] = target.value.split('x').map(Number)
		const streamClient = new StreamClient(client.current)
		try {
			await streamClient.setOptions(name, w, h)
			console.log(`Set resolution to ${w}x${h}`)
		} catch (err) {
			console.error('Failed to set resolution', err)
		}
	}
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 flex resize-x flex-col overflow-hidden border text-xs"
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

				{#if resolutions.length > 0}
					<div class="mr-2 w-32">
						<Select
							bind:value={currentResolution}
							onchange={handleResolutionChange}
						>
							<option value="">Auto</option>
							{#each resolutions as res}
								<option value={`${res.width}x${res.height}`}>{res.width}x{res.height}</option>
							{/each}
						</Select>
					</div>
				{/if}

				<button
					aria-label="close"
					class="hover:text-default"
					onclick={() =>
						(settings.current.openCameraWidgets = settings.current.openCameraWidgets.filter(
							(widget) => widget !== name
						))}
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
			{#key environment.current.viewerMode === 'monitor'}
				<CameraStream
					{name}
					partID={partID.current}
					onloadedmetadata={onMediaLoad}
					onload={onMediaLoad}
				/>
			{/key}

			<!-- FPS Pill -->
			{#if fps > 0}
				<div
					class="absolute bottom-2 left-2 z-10 rounded-[3px] bg-black/30 px-1 py-0.5 text-right font-mono text-xs text-white"
				>
					{fps.toFixed(1)}fps
				</div>
			{/if}
		</div>
	</div>
</div>
