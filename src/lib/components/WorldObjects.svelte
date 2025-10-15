<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from './portal'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import { usePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import Model from './WorldObject.svelte'
	import Label from './Label.svelte'
	import WorldState from './WorldState.svelte'
	import { determinePose } from '$lib/WorldObject.svelte'

	const points = usePointClouds()
	const pointcloudObjects = usePointcloudObjects()
	const drawAPI = useDrawAPI()
	const frames = useFrames()
	const geometries = useGeometries()
	const worldStates = useWorldStates()
	const batchedArrow = useArrows()
</script>

{#each frames.current as object (object.uuid)}
	<Pose
		name={object.name}
		parent={object.referenceFrame}
	>
		{#snippet children({ pose })}
			{@const framePose = determinePose(object, pose)}
			<Portal id={object.referenceFrame}>
				<Frame
					uuid={object.uuid}
					name={object.name}
					pose={framePose}
					geometry={object.geometry}
					metadata={object.metadata}
				>
					<PortalTarget id={object.name} />
					<Label text={object.name} />
				</Frame>
			</Portal>
		{/snippet}
	</Pose>
{/each}

{#each geometries.current as object (object.uuid)}
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

{#each worldStates.names as { name } (name)}
	<WorldState worldObjects={worldStates.current[name].worldObjects} />
{/each}

{#each points.current as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}

{#each pointcloudObjects.current as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		{#if object.geometry?.geometryType.case === 'points'}
			<Pointcloud {object}>
				<Label text={object.name} />
			</Pointcloud>
		{:else}
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
		{/if}
	</Portal>
{/each}

{#each drawAPI.points as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}

<T
	name={batchedArrow.object3d.name}
	is={batchedArrow.object3d}
	dispose={false}
	bvh={{ enabled: false }}
/>

{#each drawAPI.meshes as object (object.uuid)}
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

{#each drawAPI.nurbs as object (object.uuid)}
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

{#each drawAPI.models as object (object.uuid)}
	<Model {object}>
		<PortalTarget id={object.name} />
		<Label text={object.name} />
	</Model>
{/each}

{#each drawAPI.lines as object (object.uuid)}
	<Line {object}>
		<Label text={object.name} />
	</Line>
{/each}
