<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { PortalTarget } from '@threlte/extras'

	import { focusCameraOnEntities } from '$lib/components/Entities/focusCameraOnEntities'
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useHotkey } from '$lib/keybindings'

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

	const projection = useHotkey({
		id: 'camera.toggleProjection',
		key: 'c',
		description: 'Toggle camera projection',
		group: 'Camera',
		run: toggleProjection,
	})

	const focus = useHotkey({
		id: 'camera.focusSelection',
		key: 'f',
		description: 'Focus object',
		group: 'Camera',
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
			description={focus.description}
			keybinding={focus}
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
			keybinding={projection}
			tooltipLocation="left"
			onclick={toggleProjection}
		/>
	</fieldset>
</div>
