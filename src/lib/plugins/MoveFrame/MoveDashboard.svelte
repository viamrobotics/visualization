<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useTransformGizmo } from '$lib/hooks/useTransformGizmos.svelte'
	import { KEYBINDINGS } from '$lib/keybindings'

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
			description={KEYBINDINGS.transformTranslate.description}
			keybinding={KEYBINDINGS.transformTranslate}
			onclick={() => {
				moveGizmoOptions.mode = 'translate'
			}}
		/>
		<Button
			icon="sync"
			class="-ml-px rounded-l-none"
			active={moveGizmoOptions.mode === 'rotate'}
			description={KEYBINDINGS.transformRotate.description}
			keybinding={KEYBINDINGS.transformRotate}
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
