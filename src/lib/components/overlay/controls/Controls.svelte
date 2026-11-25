<script lang="ts">
	import { useThrelte } from '@threlte/core/webgpu'
	import { Not } from 'koota'

	import { focusCameraOnEntities } from '#lib/components/Entities/focusCameraOnEntities.js'
	import Button from '#lib/components/overlay/dashboard/Button.svelte'
	import DomPortalTarget from '#lib/components/overlay/Portals/DomPortalTarget.svelte'
	import { traits, useQuery } from '#lib/ecs/index.js'
	import { useCameraControls } from '#lib/hooks/useControls.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'
	import { useHotkey } from '#lib/keybindings/index.js'

	const { scene } = useThrelte()
	const settings = useSettings()
	const cameraControls = useCameraControls()
	const selected = useQuery(traits.Selected)
	const visible = useQuery(traits.WorldMatrix, Not(traits.InheritedInvisible))

	const isOrthographic = $derived(settings.current.cameraMode === 'orthographic')
	const hasSelection = $derived(selected.current.length > 0)
	const canFocus = $derived(hasSelection || visible.current.length > 0)

	const toggleProjection = () => {
		settings.current.cameraMode = isOrthographic ? 'perspective' : 'orthographic'
	}

	// With nothing selected, frames everything visible so a lost scene is one press away.
	const focusSelection = () => {
		focusCameraOnEntities(
			cameraControls.current,
			scene,
			hasSelection ? selected.current : visible.current
		)
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
		description: 'Focus selection, or fit the scene',
		group: 'Camera',
		when: () => canFocus,
		run: focusSelection,
	})
</script>

<div class="absolute right-2 bottom-26 z-4 flex flex-col items-end gap-2">
	<DomPortalTarget id="controls" />

	<fieldset class="flex flex-col">
		<Button
			class="rounded-b-none"
			icon="image-filter-center-focus"
			description={hasSelection ? 'Focus selection' : 'Fit scene in view'}
			keybinding={focus}
			disabled={!canFocus}
			tooltipLocation="left"
			onclick={focusSelection}
		/>
		<Button
			class="-mt-px rounded-none"
			icon="camera-outline"
			description="Reset camera"
			tooltipLocation="left"
			onclick={() => {
				cameraControls.setInitialPose()
			}}
		/>
		<Button
			class="-mt-px rounded-t-none"
			icon={isOrthographic ? 'grid-orthographic' : 'grid-perspective'}
			description={isOrthographic ? 'Switch to perspective view' : 'Switch to orthographic view'}
			keybinding={projection}
			tooltipLocation="left"
			onclick={toggleProjection}
		/>
	</fieldset>
</div>
