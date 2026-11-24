<script lang="ts">
	import { MachineConnectionEvent } from '@viamrobotics/sdk'
	import { useConnectionStatus } from '@viamrobotics/svelte-sdk'

	import { traits, useFolder } from '#lib/ecs/index.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { usePointClouds } from '#lib/hooks/usePointclouds.svelte.js'

	import PointCloud from './PointCloud.svelte'

	const partID = usePartID()
	const pointclouds = usePointClouds()
	const connectionStatus = useConnectionStatus(() => partID.current)

	// Shown while the machine has a camera, without checking `getProperties`, since some
	// cameras report no point cloud support and serve one anyway.
	useFolder(
		{
			id: 'pointclouds',
			name: 'Point clouds',
			order: 200,
			sources: [traits.PointCloudAPI],
			refreshRate: 'pointclouds',
		},
		{
			placeholder: () =>
				connectionStatus.current === MachineConnectionEvent.CONNECTED &&
				pointclouds.cameras.length > 0
					? 'No point clouds drawn'
					: undefined,
		}
	)
</script>

{#each pointclouds.cameras as name (name)}
	<PointCloud
		partID={partID.current}
		{name}
	/>
{/each}
