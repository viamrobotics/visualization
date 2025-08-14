<script lang="ts">
	import { useResourceNames } from '@viamrobotics/svelte-sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { createResourceId } from '$lib/resource'

	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current)
	const components = $derived(
		resourceNames.current.filter((resource) => resource.type === 'component')
	)
</script>

{#each components as component (createResourceId(component))}{/each}
