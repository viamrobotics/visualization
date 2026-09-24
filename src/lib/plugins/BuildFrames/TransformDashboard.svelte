<script lang="ts">
	import { Slider } from 'svelte-tweakpane-ui'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DropdownPane from '$lib/components/overlay/dashboard/DropdownPane.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const environment = useEnvironment()

	const isBuildMode = $derived(environment.current.mode === 'build')

	useHotkey({
		key: '0',
		description: 'No transform controls',
		when: () => isBuildMode,
		run: () => {
			settings.current.transformMode = 'none'
		},
	})

	useHotkey({
		key: '1',
		description: 'Translate',
		when: () => isBuildMode,
		run: () => {
			settings.current.transformMode = 'translate'
		},
	})

	useHotkey({
		key: '2',
		description: 'Rotate',
		when: () => isBuildMode,
		run: () => {
			settings.current.transformMode = 'rotate'
		},
	})

	useHotkey({
		key: '3',
		description: 'Scale',
		when: () => isBuildMode,
		run: () => {
			settings.current.transformMode = 'scale'
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
				description="No transform controls"
				hotkey="0"
				onclick={() => {
					settings.current.transformMode = 'none'
				}}
			/>
			<Button
				icon="cursor-move"
				class="-ml-px rounded-none"
				active={settings.current.transformMode === 'translate'}
				description="Translate"
				hotkey="1"
				onclick={() => {
					settings.current.transformMode = 'translate'
				}}
			/>
			<Button
				icon="sync"
				class="-ml-px rounded-none"
				active={settings.current.transformMode === 'rotate'}
				description="Rotate"
				hotkey="2"
				onclick={() => {
					settings.current.transformMode = 'rotate'
				}}
			/>
			<Button
				icon="resize"
				class="-ml-px rounded-l-none"
				active={settings.current.transformMode === 'scale'}
				description="Scale"
				hotkey="3"
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
				<Slider
					label="Move"
					min={0}
					step={0.01}
					value={settings.current.snapTranslate}
					on:change={(event) => {
						if (event.detail.origin === 'internal') {
							settings.current.snapTranslate = event.detail.value
						}
					}}
				/>
				<Slider
					label="Rotate"
					min={0}
					step={0.5}
					format={(value) => `${value}°`}
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
