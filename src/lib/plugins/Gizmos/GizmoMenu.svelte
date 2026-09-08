<script
	lang="ts"
	module
>
	import { type GizmoMode, GizmoModes } from './gizmos'

	interface ToolEntry {
		mode: GizmoMode
		label: string
	}

	const tools = [
		{ mode: GizmoModes.CoordinateSystem, label: 'Coordinate system' },
		{ mode: GizmoModes.ReferencePlane, label: 'Reference plane' },
		{ mode: GizmoModes.ReferenceGeometry, label: 'Reference geometry' },
		{ mode: GizmoModes.Polyline, label: 'Polyline' },
		{ mode: GizmoModes.Angle, label: 'Angle' },
		{ mode: GizmoModes.Arrow, label: 'Arrow' },
	] as const satisfies ToolEntry[]
</script>

<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import { Slider } from 'svelte-tweakpane-ui'

	import type { Settings } from '$lib/hooks/useSettings.svelte'

	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'

	import type {
		ArrowAxis,
		GeometryPlacement,
		LineMeasure,
		LineSpace,
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
		/**
		 * Same reasoning as `gizmos`: a context read cannot cross the dashboard portal.
		 * Only `snapping` is read here, the flag shared with the transform handles and
		 * the move gizmo.
		 */
		settings: Settings
	}

	const { gizmos, settings }: Props = $props()

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
				class="hover:bg-ghost-light focus-visible:bg-ghost-light flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 text-left"
				onclick={() => arm(tool.mode)}
			>
				{tool.label}
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
{:else if gizmos.mode === GizmoModes.Polyline}
	<div
		class="border-light font-public-sans text-subtle-1 flex flex-col gap-1.5 border-t px-2 pt-1.5 text-xs"
	>
		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-line-space-label"
		>
			<span id="gizmo-line-space-label">Space</span>
			<ToggleGroup
				options={[
					{ label: 'world', selected: gizmos.lineSpace === 'world' },
					{ label: 'screen', selected: gizmos.lineSpace === 'screen' },
				]}
				onSelect={(details) =>
					selectSingle<LineSpace>(details, (value) => {
						gizmos.lineSpace = value
					})}
			/>
		</div>

		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-line-measure-label"
		>
			<span id="gizmo-line-measure-label">Measurement</span>
			<ToggleGroup
				options={[
					{ label: 'none', selected: gizmos.lineMeasure === 'none' },
					{ label: 'segment', selected: gizmos.lineMeasure === 'segment' },
					{ label: 'total', selected: gizmos.lineMeasure === 'total' },
				]}
				onSelect={(details) =>
					selectSingle<LineMeasure>(details, (value) => {
						gizmos.lineMeasure = value
					})}
			/>
		</div>

		<div
			class="flex items-center gap-2"
			role="group"
			aria-labelledby="gizmo-line-snapping-label"
		>
			<span id="gizmo-line-snapping-label">Snapping</span>
			<Switch
				aria-labelledby="gizmo-line-snapping-label"
				bind:on={settings.snapping}
			/>
		</div>

		{#if settings.snapping}
			<Slider
				label="Snap distance"
				min={0}
				step={1}
				format={(value) => `${value}mm`}
				value={gizmos.vertexSnapDistance}
				on:change={(event) => {
					if (event.detail.origin === 'internal') {
						gizmos.vertexSnapDistance = event.detail.value
					}
				}}
			/>
		{/if}
	</div>
{/if}
