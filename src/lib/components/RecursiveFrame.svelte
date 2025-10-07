<script lang="ts">
	import Pose from './Pose.svelte'
	import RecursiveFrame from './RecursiveFrame.svelte'
	import Frame from './Frame.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import Label from './Label.svelte'
	import type { FrameHeirachyNode } from '$lib/hooks/useFrames.svelte'

	interface Props {
		frameHeirachyNode: FrameHeirachyNode
	}

	let { frameHeirachyNode }: Props = $props()
</script>

<Pose
	name={frameHeirachyNode.object.name}
	parent={frameHeirachyNode.parentName}
>
	{#snippet children({ pose })}
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
	{/snippet}
</Pose>
