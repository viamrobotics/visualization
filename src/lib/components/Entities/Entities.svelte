<script lang="ts">
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import GLTF from './GLTF.svelte'
	import Label from './Label.svelte'
	import Line from './Line.svelte'
	import Points from './Points.svelte'
	import Arrows from './Arrows/ArrowGroups.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { Not, Or } from 'koota'
	import Geometry from './Geometry.svelte'

	/**
	 * Frames from a live machine are bucketed into their own query
	 * due to needing to call `getPose` on each one
	 */
	const machineFramesEntities = useQuery(traits.FramesAPI)

	/**
	 * Geometries from a live machine are bucketed into their own query
	 * to avoid thrashing other query results due to them being
	 * potentially being polled at 30/60fps.
	 */
	const resourceGeometriesEntities = useQuery(traits.GeometriesAPI)

	/**
	 * Geometries from the world state API are bucketed into their own query
	 * to avoid thrashing other query results due to them being potentially polled at 60fps.
	 */
	const worldStateEntities = useQuery(
		traits.WorldStateStoreAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)

	/**
	 * All remaining meshes can be bucketed into a query due to lower frequency updates.
	 */
	const meshEntities = useQuery(
		Not(traits.FramesAPI),
		Not(traits.GeometriesAPI),
		Not(traits.WorldStateStoreAPI),
		Not(traits.Points),
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)

	const points = useQuery(traits.Points)
	const lines = useQuery(traits.LinePositions)
	const gltfs = useQuery(traits.GLTF)
</script>

{#each machineFramesEntities.current as entity (entity)}
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

{#each resourceGeometriesEntities.current as entity (entity)}
	<Geometry {entity}>
		<Label text={entity.get(traits.Name)} />
	</Geometry>
{/each}

{#each worldStateEntities.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each meshEntities.current as entity (entity)}
	<Frame {entity}>
		<Label text={entity.get(traits.Name)} />
	</Frame>
{/each}

{#each points.current as entity (entity)}
	<Points {entity}>
		<Label text={entity.get(traits.Name)} />
	</Points>
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

<Arrows />
