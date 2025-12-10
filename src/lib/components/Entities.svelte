<script lang="ts">
	import { Portal, PortalTarget } from './portal'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import GLTF from './GLTF.svelte'
	import Label from './Label.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { Or } from 'koota'

	const frames = useQuery(traits.FramesAPI)
	const geometries = useQuery(traits.GeometriesAPI)
	const points = useQuery(traits.PointsGeometry)
	const lines = useQuery(traits.LineGeometry)
	const gltfs = useQuery(traits.GLTF)
	const drawnMeshes = useQuery(
		traits.DrawAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry)
	)
	const worldStateMeshes = useQuery(
		traits.WorldStateStoreAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry)
	)
</script>

{#each drawnMeshes.current as entity (entity)}
	<Portal id={entity.get(traits.Parent)}>
		<Frame {entity}>
			<PortalTarget id={entity.get(traits.Name)} />
			<Label text={entity.get(traits.Name)} />
		</Frame>
	</Portal>
{/each}

{#each worldStateMeshes.current as entity (entity)}
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
	{@const parent = entity.get(traits.Parent)}

	<Portal id={parent}>
		<Pose {entity}>
			{#snippet children({ pose })}
				<Frame
					{pose}
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
