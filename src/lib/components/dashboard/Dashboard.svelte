<script>
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import PortalTarget from '../portal/PortalTarget.svelte'
	import Button from './Button.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	let { ...rest } = $props()

	const settings = useSettings()
	const partConfig = usePartConfig()
</script>

<div
	class="absolute top-2 z-1000 flex w-full justify-center gap-2"
	{...rest}
>
	<!-- camera view -->
	<fieldset class="flex">
		<Button
			icon="grid-orthographic"
			active={settings.current.cameraMode === 'orthographic'}
			description="Orthographic view"
			hotkey="C"
			onclick={() => {
				settings.current.cameraMode = 'orthographic'
			}}
		/>
		<Button
			icon="grid-perspective"
			active={settings.current.cameraMode === 'perspective'}
			description="Perspective view"
			hotkey="C"
			class="-ml-px"
			onclick={() => {
				settings.current.cameraMode = 'perspective'
			}}
		/>
	</fieldset>

	<!-- transform -->
	{#if settings.current.transforming}
		<fieldset class="flex">
			<Button
				icon="cursor-move"
				active={settings.current.transformMode === 'translate'}
				description="Translate"
				hotkey="1"
				onclick={() => {
					settings.current.transformMode = 'translate'
				}}
			/>
			<Button
				icon="sync"
				active={settings.current.transformMode === 'rotate'}
				description="Rotate"
				hotkey="2"
				class="-ml-px"
				onclick={() => {
					settings.current.transformMode = 'rotate'
				}}
			/>
			<Button
				icon="resize"
				active={settings.current.transformMode === 'scale'}
				description="Scale"
				hotkey="3"
				class="-ml-px"
				onclick={() => {
					settings.current.transformMode = 'scale'
				}}
			/>
		</fieldset>

		<!-- snapping -->
		<fieldset class="flex">
			<Button
				icon={settings.current.snapping ? 'magnet' : 'magnet-off'}
				active={settings.current.snapping}
				description="Snapping"
				onclick={() => {
					settings.current.snapping = !settings.current.snapping
				}}
			/>
		</fieldset>
	{/if}

	{#if partConfig.isDirty()}
		<fieldset class="flex">
			<div
				class="flex items-center rounded border-l-4 border-blue-600 bg-blue-100 px-4 py-2 text-blue-800"
			>
				Unsaved changes
				<a
					class="ml-2 cursor-pointer text-blue-600"
					onclick={() => {
						partConfig.resetLocalPartConfig()
					}}
				>
					Discard
				</a>
			</div>
			<button
				class="rounded bg-black px-4 py-2 text-white"
				onclick={() => {
					partConfig.saveLocalPartConfig()
				}}
			>
				Save
			</button>
		</fieldset>
	{/if}

	<fieldset class="flex">
		{#if partConfig.isDirty()}
			<div
				class="flex items-center gap-1 rounded border-l-2 border-orange-500 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800"
			>
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
				</span>
				Paused Pose
			</div>
		{:else}
			<div
				class="flex items-center gap-1 rounded border-l-2 border-green-500 bg-green-50 px-2 py-1 text-xs font-medium text-green-800"
			>
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
				</span>
				Live pose
			</div>
		{/if}
	</fieldset>

	<PortalTarget id="dashboard" />
</div>

<style>
	@keyframes ping {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		75%,
		100% {
			transform: scale(2);
			opacity: 0;
		}
	}
	.animate-ping {
		animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
</style>
