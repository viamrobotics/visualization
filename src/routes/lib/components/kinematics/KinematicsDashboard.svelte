<script lang="ts">
	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import SnapControls from '$lib/components/overlay/dashboard/SnapControls.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { TRANSFORM_KEYBINDINGS } from '$lib/hooks/transformKeybindings'
	import { useTransformGizmo } from '$lib/hooks/useTransformGizmos.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import KinematicsExportMenu from './KinematicsExportMenu.svelte'

	interface Props {
		workbench: KinematicsWorkbench
		/** The scene gizmo's mode, bound by the page. `undefined` hides the gizmo. */
		gizmoMode?: 'translate' | 'rotate' | undefined
	}

	let { workbench, gizmoMode = $bindable() }: Props = $props()

	useTransformGizmo({
		modes: () => ['translate', 'rotate', 'none'],
		select: (mode) => {
			gizmoMode = mode === 'translate' || mode === 'rotate' ? mode : undefined
		},
	})
</script>

<DashboardPortal>
	<fieldset
		class="relative flex gap-2"
		aria-label="Kinematics tools"
	>
		<div class="flex">
			<Button
				role="switch"
				icon="cursor-move"
				class="rounded-r-none"
				description={TRANSFORM_KEYBINDINGS.translate.description}
				keybinding={TRANSFORM_KEYBINDINGS.translate}
				active={gizmoMode === 'translate'}
				aria-checked={gizmoMode === 'translate'}
				onclick={() => (gizmoMode = gizmoMode === 'translate' ? undefined : 'translate')}
			/>
			<Button
				role="switch"
				icon="sync"
				class="-ml-px rounded-l-none"
				description={TRANSFORM_KEYBINDINGS.rotate.description}
				keybinding={TRANSFORM_KEYBINDINGS.rotate}
				active={gizmoMode === 'rotate'}
				aria-checked={gizmoMode === 'rotate'}
				onclick={() => (gizmoMode = gizmoMode === 'rotate' ? undefined : 'rotate')}
			/>
		</div>
		<SnapControls hasScaleStep={false} />
		<Button
			role="switch"
			icon="eye-outline"
			description="Visual"
			active={workbench.showVisualMeshes}
			aria-checked={workbench.showVisualMeshes}
			onclick={() => (workbench.showVisualMeshes = !workbench.showVisualMeshes)}
		/>
		<Button
			role="switch"
			icon="layers-triple-outline"
			description="Collision"
			active={workbench.showCollision}
			aria-checked={workbench.showCollision}
			onclick={() => (workbench.showCollision = !workbench.showCollision)}
		/>
		<KinematicsExportMenu {workbench} />
	</fieldset>
</DashboardPortal>
