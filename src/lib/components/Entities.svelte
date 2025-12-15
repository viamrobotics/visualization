<script lang="ts">
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
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)
	const worldStateMeshes = useQuery(
		traits.WorldStateStoreAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)
</script>

{#each drawnMeshes.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each worldStateMeshes.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each points.current as entity (entity)}
	<Pointcloud {entity}>
		<Label text={entity.get(traits.Name)} />
	</Pointcloud>
{/each}

{#each frames.current as entity (entity)}
	<Pose {entity}>
		{#snippet children({ pose })}
			<Frame
				{pose}
				{entity}
			>
				<Label text={entity.get(traits.Name)} />
			</Frame>
		{/snippet}
	</Pose>
{/each}

{#each geometries.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each lines.current as entity (entity)}
	<Line {entity}>
		<Label text={entity.get(traits.Name)} />
	</Line>
{/each}

{#each gltfs.current as entity (entity)}
	<GLTF {entity}>
		<Label text={entity.get(traits.Name)} />
	</GLTF>
{/each}
