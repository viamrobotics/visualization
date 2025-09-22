<script lang="ts">
	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import { WorldObject, type PointsGeometry } from '$lib/WorldObject.svelte'
	import Pointcloud from './Pointcloud.svelte'

	interface Props {
		worldObjects: WorldObject[]
		pointclouds: WorldObject<PointsGeometry>[]
	}

	let { worldObjects, pointclouds }: Props = $props()
</script>

{#each worldObjects as object (object.uuid)}
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

{#each pointclouds as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}
