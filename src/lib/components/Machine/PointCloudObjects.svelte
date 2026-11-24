<script lang="ts">
	import { MachineConnectionEvent } from '@viamrobotics/sdk'
	import { useConnectionStatus } from '@viamrobotics/svelte-sdk'

	import { traits, useFolder } from '#lib/ecs/index.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { usePointcloudObjects } from '#lib/hooks/usePointcloudObjects.svelte.js'

	import PointCloudObject from './PointCloudObject.svelte'

	const partID = usePartID()
	const pointcloudObjects = usePointcloudObjects()
	const connectionStatus = useConnectionStatus(() => partID.current)

	useFolder(
		{
			id: 'pointcloud-objects',
			name: 'Point cloud objects',
			order: 300,
			sources: [traits.PointCloudObjectAPI],
			refreshRate: 'vision',
		},
		{
			placeholder: () =>
				connectionStatus.current === MachineConnectionEvent.CONNECTED &&
				pointcloudObjects.services.length > 0
					? 'No point cloud objects drawn'
					: undefined,
		}
	)
</script>

{#each pointcloudObjects.services as name (name)}
	<PointCloudObject
		partID={partID.current}
		{name}
	/>
{/each}
