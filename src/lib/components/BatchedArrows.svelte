<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import { traits, useWorld } from '$lib/ecs'
	import { type Entity } from 'koota'
	import { Color, Vector3 } from 'three'

	const arrowBatches = $state<Record<string, BatchedArrow>>({
		world: new BatchedArrow(),
	})

	const world = useWorld()

	const direction = new Vector3()
	const origin = new Vector3()
	const color = new Color()

	const onAdd = (entity: Entity) => {
		const parent = entity.get(traits.Parent) ?? 'world'

		arrowBatches[parent] ??= new BatchedArrow()
		const batched = arrowBatches[parent]

		const pose = entity.get(traits.Pose)
		const colorRGB = entity.get(traits.Color)

		const instanceID = batched.addArrow(
			direction.set(pose?.oX ?? 0, pose?.oY ?? 0, pose?.oZ ?? 0),
			origin.set(pose?.x ?? 0, pose?.y ?? 0, pose?.z ?? 0),
			colorRGB ? color.set(colorRGB.r, colorRGB.g, colorRGB.b) : color.set('yellow')
		)

		entity.set(traits.Arrow, { instanceID })
	}

	const onPoseChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatches[parent]
		const instanceID = entity.get(traits.Arrow)?.instanceID
		const pose = entity.get(traits.Pose)

		if (instanceID && instanceID !== -1 && pose) {
			batch?.updateArrow(
				instanceID,
				direction.set(pose.oX, pose.oY, pose.oZ),
				origin.set(pose.x, pose.y, pose.z)
			)
		}
	}

	const onColorChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatches[parent]
		const instanceID = entity.get(traits.Arrow)?.instanceID
		const colorRGB = entity.get(traits.Color)

		if (instanceID && instanceID !== -1 && colorRGB) {
			color.set(colorRGB.r, colorRGB.g, colorRGB.b)
			batch.mesh.setColorAt(instanceID, color)
		}
	}

	const onRemove = (entity: Entity) => {
		const parent = entity.get(traits.Parent) ?? 'world'
		const batch = arrowBatches[parent]
		const instanceID = entity.get(traits.Arrow)?.instanceID

		if (instanceID) {
			batch.removeArrow(instanceID)
		}
	}

	$effect(() => {
		const unsubAdd = world.onAdd(traits.Arrow, onAdd)
		const unsubRemove = world.onRemove(traits.Arrow, onRemove)
		const unsubPoseChange = world.onChange(traits.Pose, onPoseChange)
		const unsubColorChange = world.onChange(traits.Color, onColorChange)

		return () => {
			unsubAdd()
			unsubRemove()
			unsubPoseChange()
			unsubColorChange()
		}
	})
</script>

{#each Object.entries(arrowBatches) as [parent, batch] (parent)}
	<Portal id={parent}>
		<T
			is={batch.mesh}
			dispose={false}
			bvh={{ enabled: false }}
		/>
	</Portal>
{/each}
