<script lang="ts">
	/**
	 * `provideMotionPlanReplayer` publishes to a module-level singleton rather than to Svelte
	 * context, so it only has to run before `MotionPlanReplayerUI` mounts, not be its ancestor.
	 */

	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideWorld, useWorld } from '$lib/ecs'
	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'

	import type { ResolveIKSolutions } from '../../inspect-ik/inspect-ik-client'

	import { provideIKInspection } from '../../inspect-ik/useIKInspection.svelte'
	import MotionPlanReplayerUI from '../../MotionPlanReplayerUI.svelte'
	import {
		type MotionPlanReplayerContext,
		type PlanEntry,
		provideMotionPlanReplayer,
	} from '../../useMotionPlanReplayer.svelte'

	interface Props {
		plans?: PlanEntry[]
		/** Stands in for leaving and re-entering replay mode, which unmounts only the UI. */
		showUI?: boolean
		/** Handed the live context and the world it draws into, once, during init. */
		onReady?: (ctx: MotionPlanReplayerContext, world: World) => void
	}

	const { plans, showUI = true, onReady }: Props = $props()

	// No spec here runs an inspection, so the resolver only has to satisfy the required argument.
	const resolveIKSolutions: ResolveIKSolutions = () => new Promise(() => {})

	provideWorld()
	provideRelationships()
	// `untrack`, matching `MotionPlanReplayer.svelte`: `plans` seeds the store once at mount.
	const ctx = provideMotionPlanReplayer(untrack(() => plans))
	provideIKInspection(resolveIKSolutions)
	untrack(() => onReady?.(ctx, useWorld()))
</script>

{#if showUI}
	<MotionPlanReplayerUI />
{/if}
