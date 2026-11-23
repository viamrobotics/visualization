<script lang="ts">
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { useFrameFocus } from '#lib/components/ScopedScene/useFrameFocus.svelte.js'
	import { provideWorld, useWorld } from '#lib/ecs/index.js'

	interface Props {
		frame: string | undefined
		onready: (world: World) => void
	}

	let { frame, onready }: Props = $props()

	provideWorld()
	const world = useWorld()

	useFrameFocus(() => frame)

	untrack(() => onready)(world)
</script>
