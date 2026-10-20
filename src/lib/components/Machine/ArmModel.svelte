<script lang="ts">
	import { ArmClient } from '@viamrobotics/sdk'
	import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'

	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { STATIC_RESOURCE_QUERY_OPTIONS } from '$lib/staticResourceQuery'

	interface Props {
		partID: string
		/** The arm whose 3D models this fetches. */
		name: string
	}

	let { partID, name }: Props = $props()

	const models = use3DModels()

	const client = createResourceClient(
		ArmClient,
		() => partID,
		() => name
	)

	const query = createResourceQuery(client, 'get3DModels', () => ({
		...STATIC_RESOURCE_QUERY_OPTIONS,
		enabled: models.shouldRender,
	}))

	// Parsed models are owned by the provider, not mirrored from this query. An
	// arm's models outlive its component so a disconnect cannot wipe them.
	$effect(() => {
		if (query.data) {
			models.parseArm(name, query.data)
		}
	})
</script>
