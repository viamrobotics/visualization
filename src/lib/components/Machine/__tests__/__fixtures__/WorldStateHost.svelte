<script lang="ts">
	/**
	 * `WorldState` reads the world and the relationship registry off Svelte
	 * context, so it needs an ancestor that provides both. The hierarchy resolver
	 * is here so children parented by name attach as they do in the app.
	 */

	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideHierarchy, provideWorld, useWorld } from '$lib/ecs'
	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'

	import WorldState from '../../WorldState.svelte'

	interface Props {
		/** Handed the world the store draws into, once, during init. */
		onReady: (world: World) => void
	}

	const { onReady }: Props = $props()

	provideWorld()
	provideHierarchy()
	provideRelationships()
	untrack(() => onReady(useWorld()))
</script>

<WorldState
	partID="part"
	name="store"
/>
