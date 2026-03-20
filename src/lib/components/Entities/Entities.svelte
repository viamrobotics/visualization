<script lang="ts">
	import { Not, Or } from 'koota'

	import { traits, useQuery } from '$lib/ecs'

	import Arrows from './Arrows/ArrowGroups.svelte'
	import Frame from './Frame.svelte'
	import Geometry from './Geometry.svelte'
	import GLTF from './GLTF.svelte'
	import Label from './Label.svelte'
	import Line from './Line.svelte'
	import Points from './Points.svelte'
	import Pose from './Pose.svelte'

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
	 * to avoid thrashing other query results due to them being streamed.
	 */
	const worldStateEntities = useQuery(
		traits.WorldStateStoreAPI,
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)

	/**
	 * Entities from the draw service API are bucketed into their own query
	 * to avoid thrashing other query results due to them being streamed.
	 */
	const drawServiceEntities = useQuery(
		traits.DrawServiceAPI,
		Not(traits.Points, traits.LinePositions, traits.GLTF),
		Or(traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry, traits.ReferenceFrame)
	)

	/**
	 * All remaining meshes can be bucketed into a query due to lower frequency updates.
	 */
	const meshEntities = useQuery(
		Not(traits.FramesAPI),
		Not(traits.GeometriesAPI),
		Not(traits.WorldStateStoreAPI),
		Not(traits.DrawServiceAPI),
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

{#each drawServiceEntities.current as entity (entity)}
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
