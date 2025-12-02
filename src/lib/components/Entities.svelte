<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from './portal'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import GLTF from './GLTF.svelte'
	import Label from './Label.svelte'
	import { determinePose } from '$lib/WorldObject.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import type { Pose as ViamPose } from '@viamrobotics/sdk'
	import { WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { Or, type Entity } from 'koota'

	const batchedArrow = useArrows()
	const weblabs = useWeblabs()

	const weblabedDeterminePose = (object: Entity, pose: ViamPose | undefined) => {
		if (weblabs.isActive(WEBLABS_EXPERIMENTS.MOTION_TOOLS_EDIT_FRAME)) {
			return determinePose(object, pose)
		}

		return pose ?? object.get(traits.Pose)
	}

	const frames = useQuery(traits.FramesAPI)
	const geometries = useQuery(traits.GeometriesAPI)
	const points = useQuery(traits.PointsGeometry)
	const lines = useQuery(traits.LineGeometry)
	const primitives = useQuery(traits.DrawAPI, Or(traits.Box, traits.Capsule, traits.Sphere))
	const gltfs = useQuery(traits.GLTF)
</script>

{#each primitives.current as entity (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<Frame {entity}>
			<PortalTarget id={entity.get(traits.Name)} />
			<Label text={entity.get(traits.Name)} />
		</Frame>
	</Portal>
{/each}

{#each points.current as entity (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<Pointcloud {entity}>
			<Label text={entity.get(traits.Name)} />
		</Pointcloud>
	</Portal>
{/each}

{#each frames.current as entity (entity)}
	{@const name = entity.get(traits.Name)}
	{@const parent = entity.get(traits.Parent)}

	<Portal id={parent}>
		<Pose
			{name}
			{parent}
		>
			{#snippet children({ pose })}
				{@const framePose = weblabedDeterminePose(entity, pose)}
				<Frame
					pose={framePose}
					{entity}
				>
					<PortalTarget id={entity.get(traits.Name)} />
					<Label text={entity.get(traits.Name)} />
				</Frame>
			{/snippet}
		</Pose>
	</Portal>
{/each}

{#each geometries.current as entity (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<Frame {entity}>
			<PortalTarget id={entity.get(traits.Name)} />
			<Label text={entity.get(traits.Name)} />
		</Frame>
	</Portal>
{/each}

{#each lines.current as entity (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<Line {entity}>
			<PortalTarget id={entity.get(traits.Name)} />
			<Label text={entity.get(traits.Name)} />
		</Line>
	</Portal>
{/each}

{#each gltfs.current as entity (entity)}
	<GLTF {entity}>
		<PortalTarget id={entity.get(traits.Name)} />
		<Label text={entity.get(traits.Name)} />
	</GLTF>
{/each}

<T
	is={batchedArrow.mesh}
	dispose={false}
	bvh={{ enabled: false }}
/>
