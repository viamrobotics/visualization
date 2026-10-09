<script lang="ts">
	import { Slider } from 'svelte-tweakpane-ui'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DropdownPane from '$lib/components/overlay/dashboard/DropdownPane.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { TRANSFORM_KEYBINDINGS } from '$lib/hooks/transformKeybindings'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useTransformGizmo } from '$lib/hooks/useTransformGizmos.svelte'

	const settings = useSettings()
	const environment = useEnvironment()

	const isBuildMode = $derived(environment.current.mode === 'build')

	// The build gizmo is a build-mode affordance, so it offers nothing outside it. That is
	// this dashboard's own rule about when it applies, not the shortcut testing the mode.
	useTransformGizmo({
		modes: () => (isBuildMode ? ['none', 'translate', 'rotate', 'scale'] : []),
		select: (mode) => {
			settings.current.transformMode = mode
		},
	})
</script>

{#if isBuildMode}
	<DashboardPortal>
		<fieldset class="flex">
			<Button
				icon="mouse-pointer"
				class="rounded-r-none"
				active={settings.current.transformMode === 'none'}
				description={TRANSFORM_KEYBINDINGS.none.description}
				keybinding={TRANSFORM_KEYBINDINGS.none}
				onclick={() => {
					settings.current.transformMode = 'none'
				}}
			/>
			<Button
				icon="cursor-move"
				class="-ml-px rounded-none"
				active={settings.current.transformMode === 'translate'}
				description={TRANSFORM_KEYBINDINGS.translate.description}
				keybinding={TRANSFORM_KEYBINDINGS.translate}
				onclick={() => {
					settings.current.transformMode = 'translate'
				}}
			/>
			<Button
				icon="sync"
				class="-ml-px rounded-none"
				active={settings.current.transformMode === 'rotate'}
				description={TRANSFORM_KEYBINDINGS.rotate.description}
				keybinding={TRANSFORM_KEYBINDINGS.rotate}
				onclick={() => {
					settings.current.transformMode = 'rotate'
				}}
			/>
			<Button
				icon="resize"
				class="-ml-px rounded-l-none"
				active={settings.current.transformMode === 'scale'}
				description={TRANSFORM_KEYBINDINGS.scale.description}
				keybinding={TRANSFORM_KEYBINDINGS.scale}
				onclick={() => {
					settings.current.transformMode = 'scale'
				}}
			/>
		</fieldset>

		<fieldset class="flex">
			<Button
				icon={settings.current.snapping ? 'magnet' : 'magnet-off'}
				class="rounded-r-none"
				active={settings.current.snapping}
				description="Snapping"
				onclick={() => {
					settings.current.snapping = !settings.current.snapping
				}}
			/>
			<DropdownPane
				title="Snapping"
				active={settings.current.snapping}
				description="Snapping settings"
			>
				<!-- Units live in the labels: tweakpane parses typed text as a bare number, so a unit in the value would make every typed edit revert. -->
				<Slider
					label="Move (mm)"
					min={0}
					step={1}
					value={settings.current.snapTranslate}
					on:change={(event) => {
						if (event.detail.origin === 'internal') {
							settings.current.snapTranslate = event.detail.value
						}
					}}
				/>
				<Slider
					label="Rotate (°)"
					min={0}
					step={0.5}
					value={settings.current.snapRotate}
					on:change={(event) => {
						if (event.detail.origin === 'internal') {
							settings.current.snapRotate = event.detail.value
						}
					}}
				/>
				<Slider
					label="Scale"
					min={0}
					step={0.01}
					value={settings.current.snapScale}
					on:change={(event) => {
						if (event.detail.origin === 'internal') {
							settings.current.snapScale = event.detail.value
						}
					}}
				/>
			</DropdownPane>
		</fieldset>

		<fieldset class="flex">
			<Button
				icon="axis-arrow"
				class="rounded-r-none"
				active={settings.current.transformSpace === 'local'}
				description="Local space"
				onclick={() => {
					settings.current.transformSpace = 'local'
				}}
			/>
			<Button
				icon="earth"
				class="-ml-px rounded-l-none"
				active={settings.current.transformSpace === 'world'}
				description="World space"
				onclick={() => {
					settings.current.transformSpace = 'world'
				}}
			/>
		</fieldset>
	</DashboardPortal>
{/if}
