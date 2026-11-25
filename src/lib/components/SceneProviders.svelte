<script lang="ts">
	import type { Snippet } from 'svelte'

	import { provideHierarchy, provideWorldMatrix } from '#lib/ecs/index.js'
	import { provideTransformControls } from '#lib/hooks/useControls.svelte.js'
	import { provideEventBus } from '#lib/hooks/useEventBus.js'
	import { provideInheritedInvisible } from '#lib/hooks/useInheritedInvisible.svelte.js'
	import { provideLinkedEntities } from '#lib/hooks/useLinked.svelte.js'
	import { provideOpacityOverrides } from '#lib/hooks/useOpacityOverrides.svelte.js'
	import { provideRelationships } from '#lib/hooks/useRelationships.svelte.js'
	import { provideSelectionOrder } from '#lib/hooks/useSelectionOrder.svelte.js'

	interface Props {
		children: Snippet
	}

	let { children }: Props = $props()

	// First, since the providers below publish to it.
	provideEventBus()
	provideTransformControls()

	provideHierarchy()
	provideWorldMatrix()
	provideInheritedInvisible()
	provideOpacityOverrides()

	provideRelationships()

	provideLinkedEntities()
	provideSelectionOrder()
</script>

{@render children()}
