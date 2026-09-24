<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'

	import { moveGizmoOptions } from './moveGizmoOptions.svelte'

	// The same keys the build dashboard uses for its gizmo. No collision: these are
	// registered only while this mounts (move mode), and the build bindings apply
	// only while build mode is active.
	useHotkey({
		key: '1',
		description: 'Translate',
		run: () => (moveGizmoOptions.mode = 'translate'),
	})

	useHotkey({
		key: '2',
		description: 'Rotate',
		run: () => (moveGizmoOptions.mode = 'rotate'),
	})
</script>

<DashboardPortal>
	<fieldset class="flex">
		<Button
			icon="cursor-move"
			class="rounded-r-none"
			active={moveGizmoOptions.mode === 'translate'}
			description="Translate"
			hotkey="1"
			onclick={() => {
				moveGizmoOptions.mode = 'translate'
			}}
		/>
		<Button
			icon="sync"
			class="-ml-px rounded-l-none"
			active={moveGizmoOptions.mode === 'rotate'}
			description="Rotate"
			hotkey="2"
			onclick={() => {
				moveGizmoOptions.mode = 'rotate'
			}}
		/>
	</fieldset>

	<fieldset class="flex">
		<Button
			icon="axis-arrow"
			class="rounded-r-none"
			active={moveGizmoOptions.space === 'local'}
			description="Local space"
			onclick={() => {
				moveGizmoOptions.space = 'local'
			}}
		/>
		<Button
			icon="earth"
			class="-ml-px rounded-l-none"
			active={moveGizmoOptions.space === 'world'}
			description="World space"
			onclick={() => {
				moveGizmoOptions.space = 'world'
			}}
		/>
	</fieldset>
</DashboardPortal>
