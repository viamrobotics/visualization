<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { TRANSFORM_KEYBINDINGS } from '$lib/hooks/transformKeybindings'
	import { useTransformGizmo } from '$lib/hooks/useTransformGizmos.svelte'

	import { moveGizmoOptions } from './moveGizmoOptions.svelte'

	// The move gizmo drags, it does not resize, and there is nothing to fall back to when
	// it is off, so it offers neither `scale` nor `none`.
	useTransformGizmo({
		modes: () => ['translate', 'rotate'],
		select: (mode) => {
			if (mode === 'translate' || mode === 'rotate') {
				moveGizmoOptions.mode = mode
			}
		},
	})
</script>

<DashboardPortal>
	<fieldset class="flex">
		<Button
			icon="cursor-move"
			class="rounded-r-none"
			active={moveGizmoOptions.mode === 'translate'}
			description={TRANSFORM_KEYBINDINGS.translate.description}
			keybinding={TRANSFORM_KEYBINDINGS.translate}
			onclick={() => {
				moveGizmoOptions.mode = 'translate'
			}}
		/>
		<Button
			icon="sync"
			class="-ml-px rounded-l-none"
			active={moveGizmoOptions.mode === 'rotate'}
			description={TRANSFORM_KEYBINDINGS.rotate.description}
			keybinding={TRANSFORM_KEYBINDINGS.rotate}
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
