<script lang="ts">
	import type { World } from 'koota'

	import { setContext, untrack } from 'svelte'

	import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

	import GizmoStorage from '../../GizmoStorage.svelte'
	import { provideGizmoStorage } from '../../useGizmoStorage.svelte'

	interface Props {
		world: World
		partID: string
		onStorage: (storage: ReturnType<typeof provideGizmoStorage>) => void
	}

	const { world, partID, onStorage }: Props = $props()

	// Read untracked: context and the storage handle are established once at setup, and
	// a harness never swaps its world or callback mid-test. Reading the props directly
	// captures the same initial value but warns that it might not be intended.
	untrack(() => {
		setContext(WORLD_CONTEXT_KEY, world)
		onStorage(provideGizmoStorage(() => partID))
	})
</script>

<GizmoStorage />
