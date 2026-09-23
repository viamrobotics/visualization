<script lang="ts">
	import { untrack } from 'svelte'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import DropdownPane from '$lib/components/overlay/dashboard/DropdownPane.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import GizmoDetails from './GizmoDetails.svelte'
	import GizmoEntities from './GizmoEntities.svelte'
	import GizmoMenu from './GizmoMenu.svelte'
	import { GizmoModes } from './gizmos'
	import AngleTool from './tools/AngleTool.svelte'
	import ArrowTool from './tools/ArrowTool.svelte'
	import CoordinateSystemTool from './tools/CoordinateSystemTool.svelte'
	import GeometryTool from './tools/GeometryTool.svelte'
	import LineTool from './tools/LineTool.svelte'
	import PlaneTool from './tools/PlaneTool.svelte'
	import { provideGizmos } from './useGizmos.svelte'

	const settings = useSettings()

	const gizmos = provideGizmos(() => {
		settings.current.interactionMode = 'navigate'
		gizmos.mode = GizmoModes.Idle
	})

	const isArmed = $derived(gizmos.mode !== GizmoModes.Idle)

	// Inherited from the retired `StaticGeometries`, which bound `=` to spawning a
	// bare box in build mode. The geometry tool supersedes it and works in every mode.
	useHotkey({
		key: '=',
		description: 'Place a reference geometry',
		run: () => {
			gizmos.mode = GizmoModes.ReferenceGeometry
		},
	})
	const isGizmoMode = $derived(settings.current.interactionMode === 'gizmo')

	// Arming a tool, from either the main button or the menu, only sets `mode`, since
	// neither has a reason to know about `interactionMode`. Claim the pointer here instead.
	// The cleanup hands it back on unmount, but only if this effect still owns it: another
	// plugin may have taken `interactionMode` away already, and unmounting should not
	// clobber whatever that plugin left in place.
	$effect(() => {
		if (isArmed) {
			settings.current.interactionMode = 'gizmo'
			return () => {
				if (settings.current.interactionMode === 'gizmo') {
					settings.current.interactionMode = 'navigate'
				}
			}
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
		<!--
			With six tools, choosing one is the primary action, so the picker owns the
			shapes button rather than hiding behind a chevron beside it. Exiting is a
			separate control that only exists while a tool is armed, which keeps each
			button to one job and off the overloaded trigger a review already rejected.
		-->
		<div class="flex">
			<DropdownPane
				plain
				title="Gizmo tools"
				active={isArmed}
				description="Gizmo tools"
				icon="shapes"
				class={isArmed ? 'rounded-r-none' : ''}
			>
				<!--
					`settings` is resolved here and handed down for the same reason `gizmos` is:
					this menu is teleported by `DashboardPortal`, which re-parents the component
					tree, so `useSettings()` in there returns undefined at runtime.
				-->
				<GizmoMenu
					{gizmos}
					settings={settings.current}
				/>
			</DropdownPane>

			{#if isArmed}
				<DashboardButton
					active
					class="-ml-px rounded-l-none"
					icon="close"
					description="Exit {gizmos.mode}"
					onclick={() => gizmos.exit()}
				/>
			{/if}
		</div>
	</fieldset>
</DashboardPortal>

{#if gizmos.mode === GizmoModes.CoordinateSystem}
	<CoordinateSystemTool />
{:else if gizmos.mode === GizmoModes.ReferenceGeometry}
	<GeometryTool />
{:else if gizmos.mode === GizmoModes.ReferencePlane}
	<PlaneTool />
{:else if gizmos.mode === GizmoModes.Polyline}
	<LineTool />
{:else if gizmos.mode === GizmoModes.Angle}
	<AngleTool />
{:else if gizmos.mode === GizmoModes.Arrow}
	<ArrowTool />
{/if}

<GizmoEntities />

<GizmoDetails />
