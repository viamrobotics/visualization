<script lang="ts">
	import type { Matrix4 } from 'three'

	import { T, useThrelte } from '@threlte/core'
	import { type Entity } from 'koota'

	import { traits, useWorld } from '$lib/ecs'
	import { BatchedAxesHelpers } from '$lib/three/BatchedAxesHelper'

	const { invalidate } = useThrelte()
	const world = useWorld()

	const axesHelpers = new BatchedAxesHelpers()

	const instances = new Map<Entity, number>()
	const dirty = new Set<Entity>()
	let scheduled = false

	const addInstance = (entity: Entity, matrix: Matrix4): number => {
		const instance = axesHelpers.addHelper(matrix)
		instances.set(entity, instance)
		return instance
	}

	const removeInstance = (entity: Entity) => {
		const instance = instances.get(entity)

		if (instance !== undefined) {
			axesHelpers.removeHelper(instance)
			instances.delete(entity)
		}
	}

	const flush = () => {
		if (dirty.size === 0) {
			return
		}

		for (const entity of dirty) {
			const worldMatrix = entity.get(traits.WorldMatrix)

			if (entity.isAlive() && worldMatrix && entity.has(traits.ShowAxesHelper)) {
				let instance = instances.get(entity)

				if (instance === undefined) {
					instance = addInstance(entity, worldMatrix)
				} else {
					axesHelpers.setMatrixAt(instance, worldMatrix)
				}

				const invisible = entity.get(traits.InheritedInvisible) ?? false
				axesHelpers.setVisibleAt(instance, !invisible)
			} else {
				removeInstance(entity)
			}
		}

		dirty.clear()
		invalidate()
	}

	const schedule = () => {
		if (scheduled) return
		scheduled = true
		queueMicrotask(() => {
			scheduled = false
			flush()
		})
	}

	const enqueue = (entity: Entity) => {
		if (!entity.has(traits.ShowAxesHelper) && !instances.has(entity)) {
			return
		}

		dirty.add(entity)
		schedule()
	}

	$effect(() => {
		for (const entity of world.query(traits.ShowAxesHelper)) {
			dirty.add(entity)
		}
		if (dirty.size > 0) schedule()

		const unsubs = [
			world.onAdd(traits.ShowAxesHelper, enqueue),
			world.onRemove(traits.ShowAxesHelper, enqueue),
			world.onAdd(traits.WorldMatrix, enqueue),
			world.onChange(traits.WorldMatrix, enqueue),
			world.onRemove(traits.WorldMatrix, enqueue),
			world.onAdd(traits.Center, enqueue),
			world.onChange(traits.Center, enqueue),
			world.onRemove(traits.Center, enqueue),
			world.onAdd(traits.InheritedInvisible, enqueue),
			world.onRemove(traits.InheritedInvisible, enqueue),
		]

		return () => {
			for (const unsub of unsubs) unsub()
			dirty.clear()
		}
	})
</script>

<T is={axesHelpers} />
