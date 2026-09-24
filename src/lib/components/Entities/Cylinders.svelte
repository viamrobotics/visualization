<!--
@component

Allocates a batched instance in `ShapeBatches` for every entity with `Cylinder`
+ `WorldMatrix` traits. `capped` picks the geometry: a closed cylinder, or the
same open-ended tube a capsule body uses.

Trait events are coalesced into a microtask flush mirroring the `WorldMatrix`
system, so a burst of changes (one reconcile tick) becomes a single batch of
instance writes and one `invalidate()`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Color, Matrix4 } from 'three'

	import type { Shape, ShapeInstanceIds } from '$lib/three/shapeBatches'

	import { asColor } from '$lib/buffer'
	import { colors } from '$lib/color'
	import { resolveOpacity, traits, useWorld } from '$lib/ecs'

	import { composeCylinderMatrix } from './composeCylinderMatrix'
	import { useShapeBatches } from './useShapeBatches'

	const { invalidate } = useThrelte()
	const world = useWorld()
	const shapes = useShapeBatches()

	const shapeFor = (capped: boolean): Shape => (capped ? 'cappedCylinder' : 'tube')

	/** `shape` is kept so a `capped` flip can be spotted without re-reading the batch. */
	interface CylinderInstance {
		ids: ShapeInstanceIds
		shape: Shape
	}

	const instanceByEntity = new Map<Entity, CylinderInstance>()

	const matrix = new Matrix4()
	const colorUtil = new Color()

	/** Same resolution order as `Boxes.svelte` / `Capsules.svelte`. */
	const resolveColor = (entity: Entity): Color => {
		const vertexColors = entity.get(traits.Colors)
		if (vertexColors && vertexColors.length >= 3) {
			return asColor(vertexColors, colorUtil)
		}

		const color = entity.get(traits.Color)
		if (color) {
			return colorUtil.setRGB(color.r, color.g, color.b)
		}

		return colorUtil.set(colors.default)
	}

	const writeAppearance = (entity: Entity, instance: CylinderInstance) => {
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)

		shapes.setAppearance(instance.ids, resolveColor(entity), resolveOpacity(entity), visible)

		/**
		 * Mirrors `useEntityEvents`' invisibility watcher: an instance that
		 * vanishes under a motionless cursor gets no pointerleave until the
		 * pointer moves, so drop its hover state here.
		 */
		if (!visible && entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}
	}

	/** Caller composes the instance transform into `matrix` first. */
	const addInstance = (entity: Entity, shape: Shape) => {
		const instance = { ids: shapes.add(entity, shape), shape }
		shapes.setMatrix(instance.ids, matrix)
		instanceByEntity.set(entity, instance)
		writeAppearance(entity, instance)
	}

	const removeInstance = (entity: Entity, instance: CylinderInstance) => {
		instanceByEntity.delete(entity)
		shapes.release(instance.ids)
	}

	/**
	 * Transform work (matrix/dimension changes, adds, removes) is tracked
	 * separately from appearance work (color/opacity/visibility) so a robot in
	 * motion only rewrites matrices, not the color texture.
	 */
	const dirtyTransform = new Set<Entity>()
	const dirtyAppearance = new Set<Entity>()
	let scheduled = false

	const flush = () => {
		if (dirtyTransform.size === 0 && dirtyAppearance.size === 0) {
			return
		}

		for (const entity of dirtyTransform) {
			const instance = instanceByEntity.get(entity)
			const cylinder = entity.isAlive() ? entity.get(traits.Cylinder) : undefined

			if (cylinder && composeCylinderMatrix(entity, matrix)) {
				const shape = shapeFor(cylinder.capped)

				if (instance === undefined) {
					addInstance(entity, shape)
				} else {
					// Both variants live in the same batch, so a `capped` flip repoints
					// the slots rather than freeing and reallocating them.
					if (instance.shape !== shape) {
						shapes.setShape(instance.ids, shape)
						instance.shape = shape
					}
					shapes.setMatrix(instance.ids, matrix)
				}
			} else if (instance !== undefined) {
				removeInstance(entity, instance)
			}
		}

		for (const entity of dirtyAppearance) {
			const instance = instanceByEntity.get(entity)
			if (instance !== undefined && entity.isAlive()) {
				writeAppearance(entity, instance)
			}
		}

		dirtyTransform.clear()
		dirtyAppearance.clear()
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

	/**
	 * `WorldMatrix` changes fire for every entity on every kinematics tick —
	 * filter to cylinder entities before touching the dirty sets.
	 * `instanceByEntity` catches entities whose `Cylinder` trait was just
	 * removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Cylinder) && !instanceByEntity.has(entity)) return
		dirty.add(entity)
		schedule()
	}

	const enqueueTransform = enqueue(dirtyTransform)
	const enqueueAppearance = enqueue(dirtyAppearance)

	$effect(() => {
		// Initial sync: existing cylinders need both an instance allocated (transform)
		// and appearance written once. At runtime the sets diverge — motion enqueues
		// transform alone, so appearance buffers aren't rewritten per kinematics tick.
		for (const entity of world.query(traits.Cylinder)) {
			dirtyTransform.add(entity)
			dirtyAppearance.add(entity)
		}
		if (dirtyTransform.size > 0) schedule()

		const unsubs = [
			world.onAdd(traits.Cylinder, enqueueTransform),
			world.onChange(traits.Cylinder, enqueueTransform),
			world.onRemove(traits.Cylinder, enqueueTransform),
			world.onAdd(traits.WorldMatrix, enqueueTransform),
			world.onChange(traits.WorldMatrix, enqueueTransform),
			world.onRemove(traits.WorldMatrix, enqueueTransform),
			world.onAdd(traits.Center, enqueueTransform),
			world.onChange(traits.Center, enqueueTransform),
			world.onRemove(traits.Center, enqueueTransform),

			world.onAdd(traits.Color, enqueueAppearance),
			world.onChange(traits.Color, enqueueAppearance),
			world.onRemove(traits.Color, enqueueAppearance),
			world.onAdd(traits.Colors, enqueueAppearance),
			world.onChange(traits.Colors, enqueueAppearance),
			world.onRemove(traits.Colors, enqueueAppearance),
			world.onAdd(traits.Opacity, enqueueAppearance),
			world.onChange(traits.Opacity, enqueueAppearance),
			world.onRemove(traits.Opacity, enqueueAppearance),
			world.onAdd(traits.OpacityOverride, enqueueAppearance),
			world.onChange(traits.OpacityOverride, enqueueAppearance),
			world.onRemove(traits.OpacityOverride, enqueueAppearance),
			world.onAdd(traits.InheritedInvisible, enqueueAppearance),
			world.onRemove(traits.InheritedInvisible, enqueueAppearance),
			world.onAdd(traits.ColliderHidden, enqueueAppearance),
			world.onRemove(traits.ColliderHidden, enqueueAppearance),
		]

		return () => {
			for (const unsub of unsubs) unsub()
			dirtyTransform.clear()
			dirtyAppearance.clear()
		}
	})
</script>
