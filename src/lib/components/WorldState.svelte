<script lang="ts">
	import { Color, Vector3 } from 'three'
	import { T } from '@threlte/core'

	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import { WorldObject } from '$lib/WorldObject.svelte'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import { poseToDirection } from '$lib/transform'

	interface Props {
		worldObjects: WorldObject[]
	}

	let { worldObjects }: Props = $props()

	const batchedArrow = useArrows()

	const arrows = $derived(worldObjects.filter((object) => object.metadata?.shape === 'arrow'))
	const objects = $derived(worldObjects.filter((object) => object.metadata?.shape !== 'arrow'))

	$effect(() => {
		batchedArrow.clear()
		arrows.forEach((arrow) => {
			batchedArrow.addArrow(
				poseToDirection(arrow.pose),
				new Vector3(arrow.pose.x, arrow.pose.y, arrow.pose.z),
				0.1,
				new Color(arrow.metadata?.color ?? 'black'),
				true
			)
		})
	})
</script>

{#each objects as object (object.uuid)}
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

<T
	name={batchedArrow.object3d.name}
	is={batchedArrow.object3d}
	dispose={false}
	bvh={{ enabled: false }}
/>
