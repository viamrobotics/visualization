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
	import { isColor } from '$lib/color'

	interface Props {
		worldObjects: WorldObject[]
	}

	let { worldObjects }: Props = $props()

	const batchedArrow = useArrows()
	const currentArrows: Record<string, { id: number; arrow: WorldObject }> = {}

	const arrows = $derived(worldObjects.filter((object) => object.metadata?.shape === 'arrow'))
	const objects = $derived(worldObjects.filter((object) => object.metadata?.shape !== 'arrow'))

	const getArrows = () => ({ ...currentArrows })
	const getArrow = (uuid: string) => currentArrows[uuid]
	const setArrow = (uuid: string, id: number, arrow: WorldObject) => {
		currentArrows[uuid] = { id, arrow }
	}

	$effect(() => {
		const toRemove = getArrows()
		arrows.forEach((arrow) => {
			const currentArrow = getArrow(arrow.uuid)
			if (currentArrow) {
				batchedArrow.removeArrow(currentArrow.id)
			}

			const color = isColor(arrow.metadata?.color)
				? arrow.metadata.color
				: new Color(arrow.metadata?.color ?? 'black')

			const id = batchedArrow.addArrow(
				poseToDirection(arrow.pose),
				new Vector3(arrow.pose.x, arrow.pose.y, arrow.pose.z),
				0.1,
				color,
				true
			)

			setArrow(arrow.uuid, id, arrow)
			delete toRemove[arrow.uuid]
		})

		Object.values(toRemove).forEach(({ id }) => {
			batchedArrow.removeArrow(id)
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
