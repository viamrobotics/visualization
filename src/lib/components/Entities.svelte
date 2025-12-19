<script lang="ts">
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import DrawnLine from './DrawnLine.svelte'
	import Pointcloud from './DrawnPoints.svelte'
	import GLTF from './GLTF.svelte'
	import Label from './Label.svelte'
	import Line from './Line.svelte'
	import Points from './Points.svelte'
	import Nurbs from './Nurbs.svelte'
	import Model from './Model.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { Not, Or } from 'koota'

	const frames = useQuery(traits.FramesAPI)
	const geometries = useQuery(traits.GeometriesAPI)
	const gltfs = useQuery(traits.GLTF)
	const droppedMeshes = useQuery(traits.DroppedFile, traits.BufferGeometry)

	const drawnPoints = useQuery(traits.PointsGeometry)
	const drawnLines = useQuery(traits.LineGeometry)
	const drawnMeshes = useQuery(
		traits.DrawAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)
	const worldStateMeshes = useQuery(
		traits.WorldStateStoreAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)

	const lines = useQuery(traits.Positions, traits.LineWidth, traits.PointSize)
	const nurbs = useQuery(traits.ControlPoints)
	const models = useQuery(Or(traits.URLContent, traits.DataContent))
	const points = useQuery(traits.Positions, traits.PointSize, Not(traits.LineWidth))
	const meshes = useQuery(
		traits.SnapshotAPI,
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

{#each droppedMeshes.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each drawnPoints.current as entity (entity)}
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

{#each drawnLines.current as entity (entity)}
	<DrawnLine {entity}>
		<Label text={entity.get(traits.Name)} />
	</DrawnLine>
{/each}

{#each gltfs.current as entity (entity)}
	<GLTF {entity}>
		<Label text={entity.get(traits.Name)} />
	</GLTF>
{/each}

{#each lines.current as entity (entity)}
	<Line {entity}>
		<Label text={entity.get(traits.Name)} />
	</Line>
{/each}

{#each points.current as entity (entity)}
	<Points {entity}>
		<Label text={entity.get(traits.Name)} />
	</Points>
{/each}

{#each nurbs.current as entity (entity)}
	<Nurbs {entity}>
		<Label text={entity.get(traits.Name)} />
	</Nurbs>
{/each}

{#each models.current as entity (entity)}
	<Model {entity}>
		<Label text={entity.get(traits.Name)} />
	</Model>
{/each}

{#each meshes.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}
