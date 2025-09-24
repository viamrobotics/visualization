<script lang="ts">
	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import { useWorldState } from '$lib/hooks/useWorldState.svelte'

	interface Props {
		worldState: ReturnType<typeof useWorldState>
	}

	let { worldState }: Props = $props()
</script>

{#each worldState.transforms as transform (transform.uuid)}
	<Portal id={transform.referenceFrame}>
		<Frame
			uuid={transform.uuid}
			name={transform.name}
			pose={transform.pose}
			geometry={transform.geometry}
			metadata={transform.metadata}
		>
			<PortalTarget id={transform.name} />
			<Label text={transform.name} />
		</Frame>
	</Portal>
{/each}

{#each worldState.pointclouds as pointcloud (pointcloud.uuid)}
	<Portal id={pointcloud.referenceFrame}>
		<Pointcloud object={pointcloud}>
			<Label text={pointcloud.name} />
		</Pointcloud>
	</Portal>
{/each}
