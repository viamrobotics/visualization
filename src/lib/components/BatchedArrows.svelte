<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import { traits, useWorld } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { Color, Vector3 } from 'three'

	const arrowBatchMap = $state<Record<string, BatchedArrow>>({
		world: new BatchedArrow(),
	})
	const batchEntries = $derived(Object.entries(arrowBatchMap))

	const world = useWorld()

	const direction = new Vector3()
	const origin = new Vector3()
	const color = new Color()

	const onAdd = (entity: Entity) => {
		const parent = entity.get(traits.Parent) ?? 'world'

		arrowBatchMap[parent] ??= new BatchedArrow()
		const batched = arrowBatchMap[parent]

		const pose = entity.get(traits.Pose)
		const colorRGB = entity.get(traits.Color)

		const instanceID = batched.addArrow(
			direction.set(pose?.oX ?? 0, pose?.oY ?? 0, pose?.oZ ?? 0),
			origin.set(pose?.x ?? 0, pose?.y ?? 0, pose?.z ?? 0).multiplyScalar(0.001),
			colorRGB ? color.set(colorRGB.r, colorRGB.g, colorRGB.b) : color.set('yellow')
		)

		entity.add(traits.Instance({ instanceID, meshID: batched.mesh.id }))
	}

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
				origin.set(pose.x, pose.y, pose.z).multiplyScalar(0.001)
			)
		}
	}

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

	const onInstanceRemove = (entity: Entity) => {
		const instance = entity.get(traits.Instance)

		for (const [, batch] of batchEntries) {
			if (batch.mesh.id === instance?.meshID) {
				batch.removeArrow(instance.instanceID)
			}
		}
	}

	$effect(() => {
		const unsubOnAdd = world.onAdd(traits.Arrow, onAdd)
		const unsubRemoveInstance = world.onRemove(traits.Instance, onInstanceRemove)
		const unsubPoseChange = world.onChange(traits.Pose, onPoseChange)
		const unsubColorChange = world.onChange(traits.Color, onColorChange)

		return () => {
			unsubOnAdd()
			unsubRemoveInstance()
			unsubPoseChange()
			unsubColorChange()
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
