<script>
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import PortalTarget from '../portal/PortalTarget.svelte'
	import Button from './Button.svelte'

	let { dashboard, ...rest } = $props()

	$inspect(dashboard)

	const settings = useSettings()
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

	<PortalTarget id="dashboard" />

	{@render dashboard?.()}
</div>
