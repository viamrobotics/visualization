<script lang="ts">
	import type { Entity } from 'koota'

	import { T } from '@threlte/core'
	import { Color, Quaternion, Vector3 } from 'three'

	import { traits, useWorld } from '$lib/ecs'
	import { OrientationVector } from '$lib/math/OrientationVector'
	import { BatchedArrow } from '$lib/three/BatchedArrow'

	const batched = new BatchedArrow()

	const world = useWorld()

	const direction = new Vector3()
	const origin = new Vector3()
	const color = new Color()
	const tempQuat = new Quaternion()
	const tempScale = new Vector3()
	const tempOv = new OrientationVector()

	/**
	 * Decompose the entity's `WorldMatrix` directly into the arrow's world
	 * origin (translation) and direction (OV components from the rotation).
	 */
	const decompose = (entity: Entity): boolean => {
		const worldMatrix = entity.get(traits.WorldMatrix)
		if (!worldMatrix) return false
		worldMatrix.decompose(origin, tempQuat, tempScale)
		tempOv.setFromQuaternion(tempQuat)
		direction.set(tempOv.x, tempOv.y, tempOv.z)
		return true
	}

	const onAdd = (entity: Entity) => {
		const colorRGB = entity.get(traits.Color)

		if (!decompose(entity)) {
			direction.set(0, 0, 0)
			origin.set(0, 0, 0)
		}

		const instanceID = batched.addArrow(
			direction,
			origin,
			colorRGB ? color.set(colorRGB.r, colorRGB.g, colorRGB.b) : color.set('yellow')
		)

		entity.add(traits.Instance({ instanceID, meshID: batched.mesh.id }))
	}

	const onWorldMatrixChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const instanceID = entity.get(traits.Instance)?.instanceID

		if (instanceID && instanceID !== -1 && decompose(entity)) {
			batched.updateArrow(instanceID, direction, origin)
		}
	}

	const onColorChange = (entity: Entity) => {
		if (!entity.has(traits.Arrow)) return

		const instanceID = entity.get(traits.Instance)?.instanceID
		const colorRGB = entity.get(traits.Color)

		if (instanceID && instanceID !== -1 && colorRGB) {
			color.set(colorRGB.r, colorRGB.g, colorRGB.b)
			batched.mesh.setColorAt(instanceID, color)
		}
	}

	const onInstanceRemove = (entity: Entity) => {
		const instance = entity.get(traits.Instance)
		if (instance && instance.meshID === batched.mesh.id) {
			batched.removeArrow(instance.instanceID)
		}
	}

	$effect(() => {
		const unsubAdd = world.onAdd(traits.Arrow, onAdd)
		const unsubRemove = world.onRemove(traits.Instance, onInstanceRemove)
		const unsubMatrixAdd = world.onAdd(traits.WorldMatrix, onWorldMatrixChange)
		const unsubMatrixChange = world.onChange(traits.WorldMatrix, onWorldMatrixChange)
		const unsubColorChange = world.onChange(traits.Color, onColorChange)

		return () => {
			unsubAdd()
			unsubRemove()
			unsubMatrixAdd()
			unsubMatrixChange()
			unsubColorChange()
		}
	})
</script>

<T
	is={batched.mesh}
	dispose={false}
	bvh={{ enabled: false }}
/>
