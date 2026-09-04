<script lang="ts">
	import { untrack } from 'svelte'
	import { Element } from 'svelte-tweakpane-ui'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import DropdownPane from '$lib/components/overlay/dashboard/DropdownPane.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import GizmoDetails from './GizmoDetails.svelte'
	import GizmoMenu from './GizmoMenu.svelte'
	import { GizmoModes } from './gizmos'
	import CoordinateSystemTool from './tools/CoordinateSystemTool.svelte'
	import { provideGizmos } from './useGizmos.svelte'

	const settings = useSettings()

	const gizmos = provideGizmos(() => {
		settings.current.interactionMode = 'navigate'
		gizmos.mode = GizmoModes.Idle
	})

	const isArmed = $derived(gizmos.mode !== GizmoModes.Idle)
	const isGizmoMode = $derived(settings.current.interactionMode === 'gizmo')

	// Arming a tool, from either the main button or the menu, only sets `mode`, since
	// neither has a reason to know about `interactionMode`. Claim the pointer here instead.
	$effect(() => {
		if (isArmed) {
			settings.current.interactionMode = 'gizmo'
		}
	})

	// Another tool (Measure, Selection) can take `interactionMode` away directly. Disarm
	// rather than leave a tool raycasting invisibly. Reading `mode` through `untrack` keeps
	// this effect's only dependency `isGizmoMode`: arming a tool changes `mode` first, before
	// the effect above claims the pointer, and a tracked read here would see that change and
	// disarm before the claim ever runs.
	$effect(() => {
		if (isGizmoMode) return
		untrack(() => {
			if (gizmos.mode !== GizmoModes.Idle) {
				gizmos.mode = GizmoModes.Idle
			}
		})
	})
</script>

<DashboardPortal>
	<fieldset>
		<div class="flex">
			<DashboardButton
				active={isArmed}
				class="rounded-r-none"
				icon="shapes"
				description={isArmed ? `Gizmo: ${gizmos.mode}` : 'Add gizmo'}
				onclick={() => {
					if (isArmed) {
						gizmos.exit()
					} else {
						gizmos.mode = GizmoModes.CoordinateSystem
					}
				}}
			/>
			<DropdownPane
				title="Gizmo tools"
				active={isArmed}
				description="Gizmo tools"
			>
				<Element>
					<GizmoMenu {gizmos} />
				</Element>
			</DropdownPane>
		</div>
	</fieldset>
</DashboardPortal>

{#if gizmos.mode === GizmoModes.CoordinateSystem}
	<CoordinateSystemTool />
{/if}

<GizmoDetails />
