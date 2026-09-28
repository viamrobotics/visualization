<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { PortalTarget } from '@threlte/extras'

	import { focusCameraOnEntities } from '$lib/components/Entities/focusCameraOnEntities'
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { KEYBINDINGS } from '$lib/keybindings'

	const { scene } = useThrelte()
	const settings = useSettings()
	const cameraControls = useCameraControls()
	const selected = useQuery(traits.Selected)

	const isOrthographic = $derived(settings.current.cameraMode === 'orthographic')
	const canFocus = $derived(selected.current.length > 0)

	const toggleProjection = () => {
		settings.current.cameraMode = isOrthographic ? 'perspective' : 'orthographic'
	}

	const focusSelection = () => {
		focusCameraOnEntities(cameraControls.current, scene, selected.current)
	}

	useHotkey(KEYBINDINGS.toggleProjection, {
		run: toggleProjection,
	})

	useHotkey(KEYBINDINGS.focusSelection, {
		when: () => canFocus,
		run: focusSelection,
	})
</script>

<div class="absolute right-2 bottom-26 z-4 flex flex-col items-end gap-2">
	<PortalTarget id="controls" />

	<fieldset class="flex flex-col">
		<Button
			class="rounded-b-none"
			icon="image-filter-center-focus"
			description={KEYBINDINGS.focusSelection.description}
			keybinding={KEYBINDINGS.focusSelection}
			disabled={!canFocus}
			tooltipLocation="left"
			onclick={focusSelection}
		/>
		<Button
			class="-my-0.5 rounded-none"
			icon="camera-outline"
			description="Reset camera"
			tooltipLocation="left"
			onclick={() => {
				cameraControls.setInitialPose()
			}}
		/>
		<Button
			class="-my-0.5 rounded-t-none"
			icon={isOrthographic ? 'grid-orthographic' : 'grid-perspective'}
			description={isOrthographic ? 'Switch to perspective view' : 'Switch to orthographic view'}
			keybinding={KEYBINDINGS.toggleProjection}
			tooltipLocation="left"
			onclick={toggleProjection}
		/>
	</fieldset>
</div>
