<script
	lang="ts"
	module
>
	import { type GizmoMode, GizmoModes } from './gizmos'

	interface ToolEntry {
		mode: GizmoMode
		label: string
		/** Phase 3 ships polyline and angle; the rest list here disabled. */
		enabled: boolean
	}

	const tools = [
		{ mode: GizmoModes.CoordinateSystem, label: 'Coordinate system', enabled: true },
		{ mode: GizmoModes.ReferencePlane, label: 'Reference plane', enabled: true },
		{ mode: GizmoModes.ReferenceGeometry, label: 'Reference geometry', enabled: true },
		{ mode: GizmoModes.Polyline, label: 'Polyline', enabled: false },
		{ mode: GizmoModes.Angle, label: 'Angle', enabled: false },
		{ mode: GizmoModes.Arrow, label: 'Arrow', enabled: true },
	] as const satisfies ToolEntry[]
</script>

<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import { Slider } from 'svelte-tweakpane-ui'

	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'

	import type {
		ArrowAxis,
		GeometryPlacement,
		PlaneAxis,
		PlanePlacement,
		ReferenceShape,
	} from './gizmos'

	import { type useGizmos } from './useGizmos.svelte'

	interface Props {
		/**
		 * Passed in rather than read from context. This menu is rendered through
		 * `DashboardPortal`, which uses threlte's `Portal` to re-parent the component
		 * tree into the dashboard, so `getContext` here does not see what `Gizmos.svelte`
		 * provided and `useGizmos()` returns undefined at runtime. Anything teleported
		 * into a portal has to take what it needs as props.
		 */
		gizmos: ReturnType<typeof useGizmos>
	}

	const { gizmos }: Props = $props()

	const arm = (mode: GizmoMode) => {
		gizmos.mode = mode
	}

	/**
	 * A single-select `ToggleGroup` is deselectable, so clicking the active
	 * option reports an empty selection. Ignore that instead of clearing the
	 * option, since every tool here always has one value chosen.
	 */
	const selectSingle = <TValue extends string>(
		details: string[],
		onSelect: (value: TValue) => void
	) => {
		const [value] = details
		if (value) {
			onSelect(value as TValue)
		}
	}
</script>

<ul class="font-public-sans text-default flex w-56 flex-col gap-0.5 text-xs">
	{#each tools as tool (tool.mode)}
		<li>
			<button
				type="button"
				disabled={!tool.enabled}
				class={[
					'flex w-full items-center justify-between rounded px-2 py-1.5 text-left',
					tool.enabled
						? 'hover:bg-ghost-light focus-visible:bg-ghost-light cursor-pointer'
						: 'text-disabled cursor-not-allowed',
				]}
				onclick={() => tool.enabled && arm(tool.mode)}
			>
				{tool.label}
				{#if !tool.enabled}
					<span class="text-subtle-2">Soon</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>

{#if gizmos.mode === GizmoModes.ReferenceGeometry}
	<div
		class="border-light font-public-sans text-subtle-1 flex flex-col gap-1.5 border-t px-2 pt-1.5 text-xs"
	>
		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-shape-label"
		>
			<span id="gizmo-shape-label">Shape</span>
			<ToggleGroup
				options={[
					{ label: 'box', selected: gizmos.referenceShape === 'box' },
					{ label: 'sphere', selected: gizmos.referenceShape === 'sphere' },
					{ label: 'capsule', selected: gizmos.referenceShape === 'capsule' },
				]}
				onSelect={(details) =>
					selectSingle<ReferenceShape>(details, (value) => {
						gizmos.referenceShape = value
					})}
			/>
		</div>

		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-geometry-placement-label"
		>
			<span id="gizmo-geometry-placement-label">Placement</span>
			<ToggleGroup
				options={[
					{
						label: 'at origin',
						value: 'at-origin',
						selected: gizmos.geometryPlacement === 'at-origin',
					},
					{ label: 'free', selected: gizmos.geometryPlacement === 'free' },
				]}
				onSelect={(details) =>
					selectSingle<GeometryPlacement>(details, (value) => {
						gizmos.geometryPlacement = value
					})}
			/>
		</div>

		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-wireframe-label"
		>
			<span id="gizmo-wireframe-label">Wireframe</span>
			<Switch
				aria-labelledby="gizmo-wireframe-label"
				bind:on={gizmos.isWireframe}
			/>
		</div>
	</div>
{:else if gizmos.mode === GizmoModes.ReferencePlane}
	<div
		class="border-light font-public-sans text-subtle-1 flex flex-col gap-1.5 border-t px-2 pt-1.5 text-xs"
	>
		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-plane-axis-label"
		>
			<span id="gizmo-plane-axis-label">Axis</span>
			<ToggleGroup
				options={[
					{ label: 'yz', selected: gizmos.planeAxis === 'yz' },
					{ label: 'xz', selected: gizmos.planeAxis === 'xz' },
					{ label: 'xy', selected: gizmos.planeAxis === 'xy' },
				]}
				onSelect={(details) =>
					selectSingle<PlaneAxis>(details, (value) => {
						gizmos.planeAxis = value
					})}
			/>
		</div>

		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-plane-placement-label"
		>
			<span id="gizmo-plane-placement-label">Placement</span>
			<ToggleGroup
				options={[
					{ label: 'free', selected: gizmos.planePlacement === 'free' },
					{ label: 'offset', selected: gizmos.planePlacement === 'offset' },
				]}
				onSelect={(details) =>
					selectSingle<PlanePlacement>(details, (value) => {
						gizmos.planePlacement = value
					})}
			/>
		</div>

		{#if gizmos.planePlacement === 'offset'}
			<Slider
				label="Offset"
				min={0}
				step={1}
				format={(value) => `${value}mm`}
				value={gizmos.planeOffset}
				on:change={(event) => {
					if (event.detail.origin === 'internal') {
						gizmos.planeOffset = event.detail.value
					}
				}}
			/>
		{/if}
	</div>
{:else if gizmos.mode === GizmoModes.Arrow}
	<div
		class="border-light font-public-sans text-subtle-1 flex items-center gap-2 border-t px-2 pt-1.5 text-xs"
		role="group"
		aria-labelledby="gizmo-arrow-axis-label"
	>
		<span id="gizmo-arrow-axis-label">Axis</span>
		<ToggleGroup
			options={[
				{ label: 'x', selected: gizmos.arrowAxis === 'x' },
				{ label: 'y', selected: gizmos.arrowAxis === 'y' },
				{ label: 'z', selected: gizmos.arrowAxis === 'z' },
				{ label: 'surface', selected: gizmos.arrowAxis === 'surface' },
			]}
			onSelect={(details) =>
				selectSingle<ArrowAxis>(details, (value) => {
					gizmos.arrowAxis = value
				})}
		/>
	</div>
{/if}
