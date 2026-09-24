<script lang="ts">
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'

	import PointCloud from './PointCloud.svelte'

	const partID = usePartID()
	const pointclouds = usePointClouds()
</script>

{#each pointclouds.cameras as name (name)}
	<PointCloud
		partID={partID.current}
		{name}
	/>
{/each}
