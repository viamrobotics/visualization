<!--
@component

Allocates a batched instance in `ShapeBatches` for every entity with `Sphere` +
`WorldMatrix` traits, instead of drawing a mesh per sphere. Trait events are
coalesced into a microtask flush, mirroring the `WorldMatrix` system, so a
burst of changes (one reconcile tick) becomes a single batch of instance writes
and one `invalidate()`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Color, Matrix4 } from 'three'

	import type { ShapeInstanceIds } from '$lib/three/shapeBatches'

	import { asColor } from '$lib/buffer'
	import { colors } from '$lib/color'
	import { resolveOpacity, traits, useWorld } from '$lib/ecs'

	import { composeSphereMatrix } from './composeSphereMatrix'
	import { useShapeBatches } from './useShapeBatches'

	const { invalidate } = useThrelte()
	const world = useWorld()
	const shapes = useShapeBatches()

	const instanceIdsByEntity = new Map<Entity, ShapeInstanceIds>()

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

	const writeAppearance = (entity: Entity, ids: ShapeInstanceIds) => {
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)

		shapes.setAppearance(ids, resolveColor(entity), resolveOpacity(entity), visible)

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
	const addInstance = (entity: Entity) => {
		const ids = shapes.add(entity, 'sphere')
		shapes.setMatrix(ids, matrix)
		instanceIdsByEntity.set(entity, ids)
		writeAppearance(entity, ids)
	}

	const removeInstance = (entity: Entity, ids: ShapeInstanceIds) => {
		instanceIdsByEntity.delete(entity)
		shapes.release(ids)
	}

	/**
	 * Transform work (matrix/dimension changes, adds, removes) is tracked
	 * separately from appearance work (color/opacity/visibility) so a robot
	 * in motion only rewrites matrices, not the color texture.
	 */
	const dirtyTransform = new Set<Entity>()
	const dirtyAppearance = new Set<Entity>()
	let scheduled = false

	const flush = () => {
		if (dirtyTransform.size === 0 && dirtyAppearance.size === 0) {
			return
		}

		for (const entity of dirtyTransform) {
			const ids = instanceIdsByEntity.get(entity)

			if (entity.isAlive() && composeSphereMatrix(entity, matrix)) {
				if (ids === undefined) {
					addInstance(entity)
				} else {
					shapes.setMatrix(ids, matrix)
				}
			} else if (ids !== undefined) {
				removeInstance(entity, ids)
			}
		}

		for (const entity of dirtyAppearance) {
			const ids = instanceIdsByEntity.get(entity)
			if (ids !== undefined && entity.isAlive()) {
				writeAppearance(entity, ids)
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
	 * filter to sphere entities before touching the dirty sets. `instanceIdsByEntity`
	 * catches entities whose `Sphere` trait was just removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Sphere) && !instanceIdsByEntity.has(entity)) return
		dirty.add(entity)
		schedule()
	}

	const enqueueTransform = enqueue(dirtyTransform)
	const enqueueAppearance = enqueue(dirtyAppearance)

	$effect(() => {
		// Initial sync: existing spheres need both an instance allocated (transform)
		// and appearance written once. At runtime the sets diverge — motion enqueues
		// transform alone, so appearance buffers aren't rewritten per kinematics tick.
		for (const entity of world.query(traits.Sphere)) {
			dirtyTransform.add(entity)
			dirtyAppearance.add(entity)
		}
		if (dirtyTransform.size > 0) schedule()

		const unsubs = [
			world.onAdd(traits.Sphere, enqueueTransform),
			world.onChange(traits.Sphere, enqueueTransform),
			world.onRemove(traits.Sphere, enqueueTransform),
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
