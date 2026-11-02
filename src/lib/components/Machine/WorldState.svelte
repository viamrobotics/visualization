<script lang="ts">
	import { useThrelte } from '@threlte/core/webgpu'
	import { WorldStateStoreClient } from '@viamrobotics/sdk'
	import { createResourceClient, useResourceGeneration } from '@viamrobotics/svelte-sdk'

	import { useWorld } from '$lib/ecs'
	import { useRelationships } from '$lib/hooks/useRelationships.svelte'
	import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

	import { createWorldStateSync, DEFAULT_WORLD_STATE_TIMING } from './worldStateSync'

	interface Props {
		partID: string
		name: string
	}

	let { partID, name }: Props = $props()

	const { invalidate } = useThrelte()

	const client = createResourceClient(
		WorldStateStoreClient,
		() => partID,
		() => name
	)

	// Changes when the store is rebuilt under the same name, which leaves `client.current` as it was.
	const generation = useResourceGeneration(
		() => partID,
		() => name
	)

	const sync = createWorldStateSync({
		world: useWorld(),
		relationships: useRelationships(),
		logs: useLogs(),
		invalidate,
		requestFrame: (callback) => {
			const id = requestAnimationFrame(callback)
			return () => cancelAnimationFrame(id)
		},
		timing: DEFAULT_WORLD_STATE_TIMING,
	})

	$effect(() => {
		sync.update({
			client: generation.canQuery ? client.current : undefined,
			generation: generation.current,
		})
	})

	$effect(() => {
		return () => sync.dispose()
	})
</script>
