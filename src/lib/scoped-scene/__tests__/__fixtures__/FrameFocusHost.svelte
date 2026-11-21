<script lang="ts">
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideWorld, useWorld } from '#lib/ecs/index.js'
	import { useFrameFocus } from '#lib/scoped-scene/useFrameFocus.svelte.js'

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
