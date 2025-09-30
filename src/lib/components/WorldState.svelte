<script lang="ts">
	import { useWorldState } from '$lib/hooks/useWorldState.svelte'
	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import PointCloudGeometry from './PointCloudGeometry.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'

	interface Props {
		worldState: ReturnType<typeof useWorldState>
	}

	let { worldState }: Props = $props()
</script>

{#each worldState.worldObjects as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Frame
			uuid={object.uuid}
			name={object.name}
			pose={object.pose}
			geometry={object.geometry}
			metadata={object.metadata}
		>
			<PortalTarget id={object.name} />
			<Label text={object.name} />
		</Frame>
	</Portal>
{/each}

{#each worldState.pointClouds as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<PointCloudGeometry {object} />
	</Portal>
{/each}
