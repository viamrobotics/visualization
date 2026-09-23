<script lang="ts">
	import type { Snippet } from 'svelte'

	import { untrack } from 'svelte'

	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import { type ResolveIKSolutions } from './inspect-ik/inspect-ik-client'
	import { provideIKInspection } from './inspect-ik/useIKInspection.svelte'
	import MotionPlanReplayerUI from './MotionPlanReplayerUI.svelte'
	import { type ResolvePlanSnapshots } from './plan-dropper'
	import { type PlanEntry, provideMotionPlanReplayer } from './useMotionPlanReplayer.svelte'

	interface Props {
		/** Seed the list on mount (e.g. app DB fetch). */
		plans?: PlanEntry[]
		children?: Snippet
		/** Host hook to resolve uploaded plans server-side. Unset keeps client parsing. */
		resolvePlanSnapshots?: ResolvePlanSnapshots
		/**
		 * Host hook to run server-side IK. Required: there is no client-side IK, and a fallback here
		 * would mean a host that forgot to wire it silently showed fixture data as real results.
		 */
		resolveIKSolutions: ResolveIKSolutions
	}

	const { plans, children, resolvePlanSnapshots, resolveIKSolutions }: Props = $props()

	provideMotionPlanReplayer(untrack(() => plans))
	provideIKInspection(untrack(() => resolveIKSolutions))

	const environment = useEnvironment()
</script>

<!-- Hidden while an editing mode owns the scene, including in bare hosts with no mode plugins. -->
{#if environment.current.mode !== 'build' && environment.current.mode !== 'move'}
	<MotionPlanReplayerUI
		{children}
		{resolvePlanSnapshots}
	/>
{/if}
