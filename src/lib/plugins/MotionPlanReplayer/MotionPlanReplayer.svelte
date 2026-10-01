<script lang="ts">
	import type { Snippet } from 'svelte'

	import { untrack } from 'svelte'

	import ModeTogglePortal from '$lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '$lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useEnvironment, useEnvironmentMode } from '$lib/hooks/useEnvironment.svelte'
	import { useFullscreen } from '$lib/plugins/Fullscreen/useFullscreen.svelte'
	import MonitorDetails from '$lib/plugins/Monitor/MonitorDetails.svelte'

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

	// Provided here rather than in the UI so loaded plans survive switching out of replay mode.
	provideMotionPlanReplayer(untrack(() => plans))
	provideIKInspection(untrack(() => resolveIKSolutions))

	const environment = useEnvironment()
	const selected = useQuery(traits.Selected)
	const fullscreen = useFullscreen()

	useEnvironmentMode('replay')
</script>

<ModeTogglePortal>
	<ModeButton
		class="-ml-px rounded-l-none"
		mode="replay"
		description="Replay and inspect motion plans"
	/>
</ModeTogglePortal>

{#if environment.current.mode === 'replay'}
	<MotionPlanReplayerUI
		{children}
		{resolvePlanSnapshots}
	/>

	{#each selected.current as entity, index (entity)}
		<MonitorDetails
			{entity}
			style="transform: translate(0, {fullscreen.baseOffset + index * 40}px)"
		/>
	{/each}
{/if}
