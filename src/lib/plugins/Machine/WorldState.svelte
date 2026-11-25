<script lang="ts">
	import { useThrelte } from '@threlte/core/webgpu'
	import { WorldStateStoreClient } from '@viamrobotics/sdk'
	import { createResourceClient, useResourceGeneration } from '@viamrobotics/svelte-sdk'
	import { MathUtils } from 'three'

	import { useWorld } from '#lib/ecs/index.js'
	import { useEventBus } from '#lib/hooks/useEventBus.js'
	import { useRelationships } from '#lib/hooks/useRelationships.svelte.js'

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

	const bus = useEventBus()
	const source = MathUtils.generateUUID()

	const sync = createWorldStateSync({
		world: useWorld(),
		relationships: useRelationships(),
		bus,
		source,
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

	// What was reported about this store no longer holds once it unmounts or its machine changes,
	// even when the next machine has a store of the same name.
	$effect(() => {
		void partID
		void name
		return () => bus.publish('diagnostic-cleared', { source })
	})
</script>
