<script lang="ts">
	/**
	 * `WorldState` reads the world and the relationship registry off Svelte
	 * context, so it needs an ancestor that provides both.
	 */

	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideWorld, useWorld } from '$lib/ecs'
	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'

	import WorldState from '../../WorldState.svelte'

	interface Props {
		/** Handed the world the store draws into, once, during init. */
		onReady: (world: World) => void
	}

	const { onReady }: Props = $props()

	provideWorld()
	provideRelationships()
	untrack(() => onReady(useWorld()))
</script>

<WorldState
	partID="part"
	name="store"
/>
