<script lang="ts">
	/**
	 * `usePreviewMove` reads the koota world off Svelte context, which only a `setContext` during
	 * init can supply, so a spec cannot stand it up in an `$effect.root`. Mirrors
	 * `MotionPlanReplayer`'s `ReplayerHarness`.
	 */

	import type { MotionClient } from '@viamrobotics/sdk'
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import type { FramesContext } from '$lib/hooks/useFrames.svelte'
	import type { Pose } from '$lib/math'

	import { provideWorld, useWorld } from '$lib/ecs'

	import type { MoveOptions } from '../../parseMoveOptions'
	import type { PreviewMove } from '../../usePreviewMove.svelte'

	import { usePreviewMove } from '../../usePreviewMove.svelte'

	interface Props {
		frames: FramesContext
		client: () => MotionClient | undefined
		service: () => string | undefined
		frameName: () => string
		destination: () => { referenceFrame: string; pose: Pose } | undefined
		moveOptions: () => MoveOptions
		invalidateOn: () => unknown
		/** Handed the live hook and the world it draws into, once, during init. */
		onReady: (preview: PreviewMove, world: World) => void
	}

	const {
		frames,
		client,
		service,
		frameName,
		destination,
		moveOptions,
		invalidateOn,
		onReady,
	}: Props = $props()

	provideWorld()
	// `untrack`: the hook and the world are both stable, so reading `onReady` once at init is the
	// intent rather than the stale capture the compiler otherwise warns about.
	untrack(() =>
		onReady(
			usePreviewMove({
				frames,
				client,
				service,
				frameName,
				destination,
				moveOptions,
				invalidateOn,
			}),
			useWorld()
		)
	)
</script>
