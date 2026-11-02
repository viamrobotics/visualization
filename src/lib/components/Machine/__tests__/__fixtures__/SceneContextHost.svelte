<script lang="ts">
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideHierarchy, provideWorld, useWorld } from '$lib/ecs'
	import { provideRelationships, useRelationships } from '$lib/hooks/useRelationships.svelte'

	interface Props {
		/** Handed the world and the relationship registry, once, during init. */
		onReady: (context: { world: World; relationships: ReturnType<typeof useRelationships> }) => void
	}

	const { onReady }: Props = $props()

	provideWorld()
	provideHierarchy()
	provideRelationships()
	untrack(() => onReady({ world: useWorld(), relationships: useRelationships() }))
</script>
