<script lang="ts">
	import { Color, Vector3 } from 'three'

	import Frame from './Frame.svelte'
	import Label from './Label.svelte'
	import Portal from './portal/Portal.svelte'
	import PortalTarget from './portal/PortalTarget.svelte'
	import { WorldObject } from '$lib/WorldObject.svelte'
	import { poseToDirection } from '$lib/transform'
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import { T } from '@threlte/core'

	interface Props {
		worldObjects: WorldObject[]
	}

	let { worldObjects }: Props = $props()

	const currentArrows: Record<string, { id: number; arrow: WorldObject }> = {}
	const arrowBatches = $state<Record<string, BatchedArrow>>({})

	const arrows = $derived(worldObjects.filter((object) => object.metadata?.shape === 'arrow'))
	const objects = $derived(worldObjects.filter((object) => object.metadata?.shape !== 'arrow'))

	const getArrows = () => ({ ...currentArrows })
	const getArrow = (referenceFrame: string, uuid: string) =>
		currentArrows[`${referenceFrame}:${uuid}`]

	const removeArrow = (referenceFrame: string, uuid: string) => {
		delete currentArrows[`${referenceFrame}:${uuid}`]
	}

	const setArrow = (arrow: WorldObject) => {
		const referenceFrame = arrow.referenceFrame ?? 'world'
		const currentArrow = getArrow(referenceFrame, arrow.uuid)
		const color = arrow.metadata?.color ?? new Color('yellow')
		const direction = poseToDirection(arrow.pose)
		const position = new Vector3(arrow.pose.x, arrow.pose.y, arrow.pose.z)

		arrowBatches[referenceFrame] ??= new BatchedArrow()
		const batchedArrow = arrowBatches[referenceFrame]

		if (currentArrow) {
			batchedArrow.updateArrow(currentArrow.id, direction, position, 0.1, color, true)
			currentArrows[`${referenceFrame}:${arrow.uuid}`] = { id: currentArrow.id, arrow }
		} else {
			const id = batchedArrow.addArrow(direction, position, 0.1, color, true)
			currentArrows[`${referenceFrame}:${arrow.uuid}`] = { id, arrow }
		}
	}

	$effect(() => {
		const toRemove = getArrows()
		arrows.forEach((arrow) => {
			setArrow(arrow)
			const referenceFrame = arrow.referenceFrame ?? 'world'
			delete toRemove[`${referenceFrame}:${arrow.uuid}`]
		})

		Object.values(toRemove).forEach(({ id, arrow }) => {
			const referenceFrame = arrow.referenceFrame ?? 'world'
			arrowBatches[referenceFrame].removeArrow(id)
			removeArrow(referenceFrame, arrow.uuid)
		})
	})
</script>

{#each Object.entries(arrowBatches) as [referenceFrame, batch] (referenceFrame)}
	<Portal id={referenceFrame}>
		<T
			name={batch.object3d.name}
			is={batch.object3d}
			dispose={false}
			bvh={{ enabled: false }}
		/>
	</Portal>
{/each}

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
