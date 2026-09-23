<script
	lang="ts"
	generics="TProps extends Record<string, unknown>"
>
	import type { World } from 'koota'
	import type { Component } from 'svelte'

	import { provideWorld } from 'koota/svelte'

	interface Props {
		world: World
		component: Component<TProps>
		props: TProps
	}

	const { world, component: Child, props }: Props = $props()

	// koota/svelte keeps its context key private, so specs provide the world through this wrapper.
	provideWorld(world)
</script>

<Child {...props} />
