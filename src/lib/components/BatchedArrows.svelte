<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { Color, Vector3 } from 'three'
	import { asFloat32Array, STRIDE } from '$lib/buffer'

	const arrowBatchMap = $state<Record<string, BatchedArrow>>({
		world: new BatchedArrow(),
	})
	const batchEntries = $derived(Object.entries(arrowBatchMap))

	const instanceMap = new Map<string, number[]>()

	const world = useWorld()

	const direction = new Vector3()
	const origin = new Vector3()
	const color = new Color()

	// Handler for legacy Arrow trait (single arrow per entity)
	const onAddArrow = (entity: Entity) => {
		const parent = entity.get(traits.Parent) ?? 'world'

		arrowBatchMap[parent] ??= new BatchedArrow()
		const batched = arrowBatchMap[parent]

		const pose = entity.get(traits.Pose)
		const colorRGB = entity.get(traits.Color)

		const instanceID = batched.addArrow(
			direction.set(pose?.oX ?? 0, pose?.oY ?? 0, pose?.oZ ?? 0),
			origin.set(pose?.x ?? 0, pose?.y ?? 0, pose?.z ?? 0),
			colorRGB ? color.set(colorRGB.r, colorRGB.g, colorRGB.b) : color.set('yellow')
		)

		entity.add(traits.Instance({ instanceID, meshID: batched.mesh.id }))
	}

	// Handler for proto Arrows trait (multiple arrows per entity)
	const onAddArrows = (entity: Entity) => {
		const parent = entity.get(traits.Parent) ?? 'world'
		const arrowsData = entity.get(traits.Arrows)
		const colorsData = entity.get(traits.ColorsRGBA)

		if (!arrowsData || arrowsData.length === 0) return

		arrowBatchMap[parent] ??= new BatchedArrow()
		const batched = arrowBatchMap[parent]

		const poses = asFloat32Array(arrowsData)
		const numArrows = Math.floor(poses.length / STRIDE.ARROWS)
		const numColors = colorsData ? Math.floor(colorsData.length / STRIDE.COLORS_RGBA) : 0
		const hasPerArrowColors = numColors >= numArrows

		const instanceIDs: number[] = []

		for (let i = 0; i < numArrows; i++) {
			const offset = i * STRIDE.ARROWS
			// Poses are in mm, convert to m
			origin.set(poses[offset] * 0.001, poses[offset + 1] * 0.001, poses[offset + 2] * 0.001)
			direction.set(poses[offset + 3], poses[offset + 4], poses[offset + 5])

			// Get color: per-arrow, single, or default green
			if (hasPerArrowColors && colorsData) {
				const colorOffset = i * STRIDE.COLORS_RGBA
				color.setRGB(
					colorsData[colorOffset] / 255,
					colorsData[colorOffset + 1] / 255,
					colorsData[colorOffset + 2] / 255
				)
			} else if (colorsData && colorsData.length >= 4) {
				color.setRGB(colorsData[0] / 255, colorsData[1] / 255, colorsData[2] / 255)
			} else {
				color.copy(new Color(0, 1, 0))
			}

			const instanceID = batched.addArrow(direction, origin, color)
			instanceIDs.push(instanceID)
		}

		const entityID = entity.get(traits.UUID) ?? ''
		instanceMap.set(entityID, instanceIDs)
	}

	// Handler for legacy Arrow pose changes
	const onPoseChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatchMap[parent]
		const instanceID = entity.get(traits.Instance)?.instanceID
		const pose = entity.get(traits.Pose)

		if (instanceID && instanceID !== -1 && pose) {
			batch?.updateArrow(
				instanceID,
				direction.set(pose.oX, pose.oY, pose.oZ),
				origin.set(pose.x, pose.y, pose.z)
			)
		}
	}

	// Handler for legacy Arrow color changes
	const onColorChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatchMap[parent]
		const instanceID = entity.get(traits.Instance)?.instanceID
		const colorRGB = entity.get(traits.Color)

		if (instanceID && instanceID !== -1 && colorRGB) {
			color.set(colorRGB.r, colorRGB.g, colorRGB.b)
			batch.mesh.setColorAt(instanceID, color)
		}
	}

	// Handler for legacy Arrow instance removal
	const onInstanceRemove = (entity: Entity) => {
		const instance = entity.get(traits.Instance)

		for (const [, batch] of batchEntries) {
			if (batch.mesh.id === instance?.meshID) {
				batch.removeArrow(instance.instanceID)
			}
		}
	}

	// Handler for proto Arrows entity removal
	const onArrowsRemove = (entity: Entity) => {
		const entityID = entity.get(traits.UUID) ?? ''
		const instanceIDs = instanceMap.get(entityID)
		if (!instanceIDs) return

		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatchMap[parent]
		for (const instanceID of instanceIDs) {
			batch?.removeArrow(instanceID)
		}

		instanceMap.delete(entityID)
	}

	$effect(() => {
		// Legacy Arrow trait subscriptions
		const unsubAddArrow = world.onAdd(traits.Arrow, onAddArrow)
		const unsubRemoveInstance = world.onRemove(traits.Instance, onInstanceRemove)
		const unsubPoseChange = world.onChange(traits.Pose, onPoseChange)
		const unsubColorChange = world.onChange(traits.Color, onColorChange)

		// Proto Arrows trait subscriptions
		const unsubAddArrows = world.onAdd(traits.Arrows, onAddArrows)
		const unsubRemoveArrows = world.onRemove(traits.Arrows, onArrowsRemove)

		return () => {
			unsubAddArrow()
			unsubRemoveInstance()
			unsubPoseChange()
			unsubColorChange()
			unsubAddArrows()
			unsubRemoveArrows()
		}
	})
</script>

{#each batchEntries as [parent, batch] (parent)}
	<Portal id={parent}>
		<T
			is={batch.mesh}
			dispose={false}
			bvh={{ enabled: false }}
		/>
	</Portal>
{/each}
