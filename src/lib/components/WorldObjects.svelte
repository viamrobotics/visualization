<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from './portal'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import Pose from './Pose.svelte'
	import Frame from './Frame.svelte'
	import Line from './Line.svelte'
	import Pointcloud from './Pointcloud.svelte'
	import Model from './WorldObject.svelte'
	import Label from './Label.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import WorldState from './WorldState.svelte'
	import type { FrameHeirachyNode } from '$lib/hooks/useFrames.svelte'
	import RecursiveFrame from './RecursiveFrame.svelte'

	const points = usePointClouds()
	const drawAPI = useDrawAPI()
	const frames = useFrames()
	const geometries = useGeometries()
	const worldStates = useWorldStates()

	const frameHeirachy = $derived.by(() => {
		const queue: FrameHeirachyNode[] = []
		const treeNodes: FrameHeirachyNode[] = []

		for (const frame of frames.current) {
			const node: FrameHeirachyNode = {
				name: frame.name,
				parentName: frame.referenceFrame ?? 'world',
				object: frame,
				children: [],
			}

			if (frame.referenceFrame === 'world') {
				treeNodes.push(node)
			} else {
				queue.push(node)
			}
		}

		while (queue.length > 0) {
			const node = queue.shift()
			if (node) {
				const parentNode = treeNodes.find((treeNode) => treeNode.name === node.parentName)
				if (parentNode) {
					parentNode.children.push(node)
					treeNodes.push(node)
				} else {
					queue.push(node)
				}
			}
		}

		return treeNodes
	})
</script>

{#each frameHeirachy.filter((node) => node.object.referenceFrame === 'world') as frameHeirachyNode (frameHeirachyNode.object.uuid)}
	<Pose name={frameHeirachyNode.object.name}>
		{#snippet children({ pose })}
			{#if pose}
				<Frame
					uuid={frameHeirachyNode.object.uuid}
					name={frameHeirachyNode.object.name}
					{pose}
					geometry={frameHeirachyNode.object.geometry}
					metadata={frameHeirachyNode.object.metadata}
				>
					{#each frameHeirachyNode.children as childNode (childNode.object.uuid)}
						<RecursiveFrame frameHeirachyNode={childNode} />
					{/each}
					<PortalTarget id={frameHeirachyNode.object.name} />
					<Label text={frameHeirachyNode.object.name} />
				</Frame>
			{:else}
				<Portal id={frameHeirachyNode.object.referenceFrame}>
					<Frame
						uuid={frameHeirachyNode.object.uuid}
						name={frameHeirachyNode.object.name}
						pose={pose ?? frameHeirachyNode.object.pose}
						geometry={frameHeirachyNode.object.geometry}
						metadata={frameHeirachyNode.object.metadata}
					>
						{#each frameHeirachyNode.children as childNode (childNode.object.uuid)}
							<RecursiveFrame frameHeirachyNode={childNode} />
						{/each}
						<PortalTarget id={frameHeirachyNode.object.name} />
						<Label text={frameHeirachyNode.object.name} />
					</Frame>
				</Portal>
			{/if}
		{/snippet}
	</Pose>
{/each}

<!-- {#each frames.current as object (object.uuid)}
	<Pose name={object.name}>
		{#snippet children({ pose })}
			{#if pose}
				<Frame
					uuid={object.uuid}
					name={object.name}
					{pose}
					geometry={object.geometry}
					metadata={object.metadata}
				>
					<PortalTarget id={object.name} />
					<Label text={object.name} />
				</Frame>
			{:else}
				<Portal id={object.referenceFrame}>
					<Frame
						uuid={object.uuid}
						name={object.name}
						pose={pose ?? object.pose}
						geometry={object.geometry}
						metadata={object.metadata}
					>
						<PortalTarget id={object.name} />
						<Label text={object.name} />
					</Frame>
				</Portal>
			{/if}
		{/snippet}
	</Pose>
{/each} -->

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

{#each drawAPI.points as object (object.uuid)}
	<Portal id={object.referenceFrame}>
		<Pointcloud {object}>
			<Label text={object.name} />
		</Pointcloud>
	</Portal>
{/each}

{#if drawAPI.poses.length > 0}
	<T
		name={drawAPI.object3ds.batchedArrow.object3d.name}
		is={drawAPI.object3ds.batchedArrow.object3d}
		dispose={false}
		bvh={{ enabled: false }}
	/>
{/if}

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
