<script lang="ts">
	import { Color, Vector3 } from 'three'

	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import { WorldObject } from '$lib/WorldObject.svelte'
	import { poseToDirection } from '$lib/transform'
	import { useArrows } from '$lib/hooks/useArrows.svelte'

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
	const removeArrow = (uuid: string) => delete currentArrows[uuid]
	const setArrow = (arrow: WorldObject) => {
		const currentArrow = getArrow(arrow.uuid)
		const color = arrow.metadata?.color ?? new Color('yellow')
		const direction = poseToDirection(arrow.pose)
		const position = new Vector3(arrow.pose.x, arrow.pose.y, arrow.pose.z)

		if (currentArrow) {
			batchedArrow.updateArrow(currentArrow.id, direction, position, 0.5, color, true)
			currentArrows[arrow.uuid] = { id: currentArrow.id, arrow }
		} else {
			const id = batchedArrow.addArrow(direction, position, 0.5, color, true)
			currentArrows[arrow.uuid] = { id, arrow }
		}
	}

	$effect(() => {
		const toRemove = getArrows()
		arrows.forEach((arrow) => {
			setArrow(arrow)
			delete toRemove[arrow.uuid]
		})

		Object.values(toRemove).forEach(({ id, arrow }) => {
			batchedArrow.removeArrow(id)
			removeArrow(arrow.uuid)
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
