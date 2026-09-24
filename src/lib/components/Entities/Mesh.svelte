<!--
@component

Allocates a batched instance in `ShapeBatches` for one entity carrying a
`BufferGeometry` trait, so a parsed mesh sorts against the primitives instead of
against them. Three orders transparent objects by each object's `matrixWorld`
position, and a batch is one object, so anything left outside it draws wholly
before or wholly after every batched shape no matter where it sits.

The geometry is uploaded once per distinct mesh and refcounted, so several
entities sharing a mesh share the upload.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { ShapeInstanceIds } from '$lib/three/shapeBatches'

	import { useThrelte } from '@threlte/core'
	import { Color, Matrix4 } from 'three'

	import { asColor } from '$lib/buffer'
	import { colors } from '$lib/color'
	import { traits, useOpacity, useTag, useTrait } from '$lib/ecs'

	import { composeMeshMatrix } from './composeMeshMatrix'
	import { useShapeBatches } from './useShapeBatches'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const shapes = useShapeBatches()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const center = useTrait(() => entity, traits.Center)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)
	const colliderHidden = useTag(() => entity, traits.ColliderHidden)
	const entityColors = useTrait(() => entity, traits.Colors)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useOpacity(() => entity)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)

	const colorUtil = new Color()
	const matrix = new Matrix4()

	/**
	 * A geometry that parsed to nothing would upload an empty slot and draw
	 * nothing, so it is skipped until the trait is replaced with a real one.
	 */
	const geometry = $derived.by(() => {
		const parsed = bufferGeometry.current
		if (!parsed || (parsed.getAttribute('position')?.count ?? 0) === 0) return undefined
		return parsed
	})

	/**
	 * Per-vertex colors ride in the geometry and multiply with the instance
	 * color, so an instance color of white is what leaves them untinted.
	 */
	const hasVertexColors = $derived(geometry?.getAttribute('color') !== undefined)

	const color = $derived.by(() => {
		if (hasVertexColors) return colorUtil.set(0xffffff)
		if (entityColors.current) return asColor(entityColors.current, colorUtil)

		const rgb = entityColor.current
		if (rgb) return colorUtil.setRGB(rgb.r, rgb.g, rgb.b)

		return colorUtil.set(colors.default)
	})

	let instance = $state.raw<ShapeInstanceIds | undefined>()

	$effect(() => {
		const current = geometry
		if (!current) return

		const allocated = shapes.addMesh(entity, shapes.registerMesh(current))
		instance = allocated

		return () => {
			shapes.release(allocated)
			shapes.releaseMesh(current)
			instance = undefined
		}
	})

	$effect(() => {
		// Read both so a pose change re-runs this, not only an instance swap.
		void worldMatrix.current
		void center.current

		if (!instance || !composeMeshMatrix(entity, matrix)) return

		shapes.setMatrix(instance, matrix)
		invalidate()
	})

	$effect(() => {
		if (!instance) return

		const visible = invisible.current !== true && !colliderHidden.current
		shapes.setAppearance(instance, color, opacity.current, visible)

		/**
		 * Mirrors `useEntityEvents`' invisibility watcher: an instance that
		 * vanishes under a motionless cursor gets no pointerleave until the
		 * pointer moves, so drop its hover state here.
		 */
		if (!visible && entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}

		invalidate()
	})
</script>
