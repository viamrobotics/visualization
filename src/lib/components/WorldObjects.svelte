<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from './portal'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import Model from './WorldObject.svelte'
	import Label from './Label.svelte'
	import WorldState from './WorldState.svelte'
	import { determinePose } from '$lib/WorldObject.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import type { Pose as ViamPose } from '@viamrobotics/sdk'
	import { WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import { useSnapshot } from '$lib/hooks/useSnapshot.svelte'
	import Snapshot from './Snapshot.svelte'

	const points = usePointClouds()
	const drawAPI = useDrawAPI()
	const frames = useFrames()
	const geometries = useGeometries()
	const worldStates = useWorldStates()
	const batchedArrow = useArrows()
	const snapshot = useSnapshot()
	const weblabs = useWeblabs()

	const weblabedDeterminePose = (object: WorldObject, pose: ViamPose | undefined) => {
		if (weblabs.isActive(WEBLABS_EXPERIMENTS.MOTION_TOOLS_EDIT_FRAME)) {
			return determinePose(object, pose)
		}
		return pose ?? object.pose
	}
</script>

{#each frames.current as object (object.uuid)}
	<Pose
		name={object.name}
		parent={object.referenceFrame}
	>
		{#snippet children({ pose })}
			{@const framePose = weblabedDeterminePose(object, pose)}
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

{#if snapshot.current}
	<Snapshot
		frames={snapshot.frames}
		worldObjects={snapshot.worldObjects}
	/>
{/if}

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

{#each drawAPI.frames as object (object.uuid)}
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
