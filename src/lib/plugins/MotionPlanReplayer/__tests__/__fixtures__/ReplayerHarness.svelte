<script lang="ts">
	/**
	 * `provideMotionPlanReplayer` reads the world and the relationship registry off Svelte context,
	 * which only a `setContext` during init can supply, so a spec cannot stand it up in an
	 * `$effect.root`.
	 */

	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideWorld, useWorld } from '$lib/ecs'
	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'

	import type { MotionPlanReplayerContext } from '../../useMotionPlanReplayer.svelte'

	import { provideMotionPlanReplayer } from '../../useMotionPlanReplayer.svelte'

	interface Props {
		/** Handed the live context and the world it draws into, once, during init. */
		onReady: (ctx: MotionPlanReplayerContext, world: World) => void
	}

	const { onReady }: Props = $props()

	provideWorld()
	provideRelationships()
	// `untrack`: the context and the world are both stable, so reading `onReady` once at init is
	// the intent rather than the stale capture the compiler otherwise warns about.
	untrack(() => onReady(provideMotionPlanReplayer(), useWorld()))
</script>
