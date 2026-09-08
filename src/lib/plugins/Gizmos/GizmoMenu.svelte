<script
	lang="ts"
	module
>
	import { type GizmoMode, GizmoModes } from './gizmos'

	interface ToolEntry {
		mode: GizmoMode
		label: string
		/** Phase 1 ships only the coordinate-system tool; the rest list here disabled. */
		enabled: boolean
	}

	const tools = [
		{ mode: GizmoModes.CoordinateSystem, label: 'Coordinate system', enabled: true },
		{ mode: GizmoModes.ReferencePlane, label: 'Reference plane', enabled: false },
		{ mode: GizmoModes.ReferenceGeometry, label: 'Reference geometry', enabled: false },
		{ mode: GizmoModes.Polyline, label: 'Polyline', enabled: false },
		{ mode: GizmoModes.Angle, label: 'Angle', enabled: false },
		{ mode: GizmoModes.Arrow, label: 'Arrow', enabled: false },
	] as const satisfies ToolEntry[]
</script>

<script lang="ts">
	import { useGizmos } from './useGizmos.svelte'

	const gizmos = useGizmos()

	const arm = (mode: GizmoMode) => {
		gizmos.mode = mode
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
