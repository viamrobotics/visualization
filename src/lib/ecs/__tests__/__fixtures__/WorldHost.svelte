<script lang="ts">
	import type { World } from 'koota'

	import { provideWorld, useWorld } from '#lib/ecs/index.js'

	interface Props {
		onworld: (world: World) => void
	}

	let { onworld }: Props = $props()

	provideWorld()
	const world = useWorld()

	$effect(() => {
		onworld(world)
	})
</script>
