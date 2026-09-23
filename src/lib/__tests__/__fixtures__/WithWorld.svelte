<script lang="ts">
	import type { World } from 'koota'

	import { provideWorld } from 'koota/svelte'
	import { type Component, untrack } from 'svelte'

	interface Props {
		world: World
		component: Component<never>
		props: object
	}

	const { world, component, props }: Props = $props()

	// renderWithWorld pairs component and props with matching types, so widening here is safe.
	const Child = $derived(component as Component<object>)

	// koota/svelte keeps its context key private, so specs provide the world through this wrapper.
	provideWorld(untrack(() => world))
</script>

<Child {...props} />
