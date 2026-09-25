<!--
@component

Allocates three batched instances in `ShapeBatches` for every entity with
`Capsule` + `WorldMatrix` traits. A capsule splits into one open-ended cylinder
body and two hemisphere caps (`l` is the *total* length, so the body spans
`l − 2r`).

Trait events are coalesced into a microtask flush mirroring the `WorldMatrix`
system, so a burst of changes (one reconcile tick) becomes a single batch of
instance writes and one `invalidate()`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Color, Matrix4 } from 'three'

	import type { ShapeInstanceIds } from '$lib/three/shapeBatches'

	import { asColor } from '$lib/buffer'
	import { colors } from '$lib/color'
	import { resolveOpacity, traits, useWorld } from '$lib/ecs'

	import { composeCapsuleMatrices } from './composeCapsuleMatrices'
	import { useShapeBatches } from './useShapeBatches'

	const { invalidate } = useThrelte()
	const world = useWorld()
	const shapes = useShapeBatches()

	/** The three parts one capsule draws. Each carries its own slot pair. */
	interface CapsuleInstances {
		body: ShapeInstanceIds
		headTop: ShapeInstanceIds
		headBottom: ShapeInstanceIds
	}

	const instancesByEntity = new Map<Entity, CapsuleInstances>()

	const bodyMatrix = new Matrix4()
	const headTopMatrix = new Matrix4()
	const headBottomMatrix = new Matrix4()
	const colorUtil = new Color()

	/** Same resolution order as `Boxes.svelte` / `Spheres.svelte`. */
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

	const writeAppearance = (entity: Entity, instances: CapsuleInstances) => {
		const color = resolveColor(entity)
		const opacity = resolveOpacity(entity)
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)

		/**
		 * The cylinder collapses once `l ≤ 2r`; hide it so the two caps read as a
		 * sphere (mirrors the old `{#if midsection > 0}` guard). The caps stay
		 * visible with the entity.
		 */
		const capsule = entity.get(traits.Capsule)
		const bodyVisible = visible && capsule !== undefined && capsule.l - 2 * capsule.r > 0

		shapes.setAppearance(instances.body, color, opacity, bodyVisible)
		shapes.setAppearance(instances.headTop, color, opacity, visible)
		shapes.setAppearance(instances.headBottom, color, opacity, visible)

		/**
		 * Mirrors `useEntityEvents`' invisibility watcher: an instance that
		 * vanishes under a motionless cursor gets no pointerleave until the
		 * pointer moves, so drop its hover state here.
		 */
		if (!visible && entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}
	}

	/** Caller composes the three instance transforms into the matrices first. */
	const addInstance = (entity: Entity) => {
		const instances: CapsuleInstances = {
			body: shapes.add(entity, 'tube'),
			headTop: shapes.add(entity, 'capsuleHead'),
			headBottom: shapes.add(entity, 'capsuleHead'),
		}

		shapes.setMatrix(instances.body, bodyMatrix)
		shapes.setMatrix(instances.headTop, headTopMatrix)
		shapes.setMatrix(instances.headBottom, headBottomMatrix)

		instancesByEntity.set(entity, instances)
		writeAppearance(entity, instances)
	}

	const removeInstance = (entity: Entity, instances: CapsuleInstances) => {
		instancesByEntity.delete(entity)
		shapes.release(instances.body)
		shapes.release(instances.headTop)
		shapes.release(instances.headBottom)
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
			const instances = instancesByEntity.get(entity)

			if (
				entity.isAlive() &&
				composeCapsuleMatrices(entity, bodyMatrix, headTopMatrix, headBottomMatrix)
			) {
				if (instances === undefined) {
					addInstance(entity)
				} else {
					shapes.setMatrix(instances.body, bodyMatrix)
					shapes.setMatrix(instances.headTop, headTopMatrix)
					shapes.setMatrix(instances.headBottom, headBottomMatrix)
				}
			} else if (instances !== undefined) {
				removeInstance(entity, instances)
			}
		}

		for (const entity of dirtyAppearance) {
			const instances = instancesByEntity.get(entity)
			if (instances !== undefined && entity.isAlive()) {
				writeAppearance(entity, instances)
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
	 * filter to capsule entities before touching the dirty sets.
	 * `instancesByEntity` catches entities whose `Capsule` trait was just
	 * removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Capsule) && !instancesByEntity.has(entity)) return
		dirty.add(entity)
		schedule()
	}

	const enqueueTransform = enqueue(dirtyTransform)
	const enqueueAppearance = enqueue(dirtyAppearance)

	$effect(() => {
		// Initial sync: existing capsules need both an instance allocated
		// (transform) and appearance written once.
		for (const entity of world.query(traits.Capsule)) {
			dirtyTransform.add(entity)
			dirtyAppearance.add(entity)
		}
		if (dirtyTransform.size > 0) schedule()

		const unsubs = [
			world.onAdd(traits.Capsule, enqueueTransform),
			world.onChange(traits.Capsule, enqueueTransform),
			world.onRemove(traits.Capsule, enqueueTransform),
			/**
			 * Dimensions drive both the matrices (radius/length scale) and the
			 * body's visibility (the cylinder vanishes once `l ≤ 2r`), so a
			 * `Capsule` change also refreshes appearance.
			 */
			world.onChange(traits.Capsule, enqueueAppearance),
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
