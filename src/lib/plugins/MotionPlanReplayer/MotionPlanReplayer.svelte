<script lang="ts">
	import type { Snippet } from 'svelte'

	import { untrack } from 'svelte'

	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import MotionPlanReplayerUI from './MotionPlanReplayerUI.svelte'
	import { type ResolvePlanSnapshots } from './plan-dropper'
	import { type PlanEntry, provideMotionPlanReplayer } from './useMotionPlanReplayer.svelte'

	interface Props {
		/** Seed the list on mount (e.g. app DB fetch). */
		plans?: PlanEntry[]
		children?: Snippet
		/** Host hook to resolve uploaded plans server-side. Unset keeps client parsing. */
		resolvePlanSnapshots?: ResolvePlanSnapshots
	}

	const { plans, children, resolvePlanSnapshots }: Props = $props()

	provideMotionPlanReplayer(untrack(() => plans))

	const environment = useEnvironment()
</script>

<!-- Hidden while an editing mode owns the scene, including in bare hosts with no mode plugins. -->
{#if environment.current.mode !== 'build' && environment.current.mode !== 'move'}
	<MotionPlanReplayerUI
		{children}
		{resolvePlanSnapshots}
	/>
{/if}
