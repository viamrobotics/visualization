<script lang="ts">
	import { Slider } from 'svelte-tweakpane-ui'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import Button from './Button.svelte'
	import DropdownPane from './DropdownPane.svelte'

	interface Props {
		/** Offer the scale step. A gizmo that never scales leaves it out. */
		hasScaleStep: boolean
	}

	const { hasScaleStep }: Props = $props()

	const settings = useSettings()
</script>

<fieldset class="flex">
	<Button
		role="switch"
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
			label="Move (m)"
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
		{#if hasScaleStep}
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
		{/if}
	</DropdownPane>
</fieldset>
