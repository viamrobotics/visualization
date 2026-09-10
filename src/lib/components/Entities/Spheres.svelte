<!--
@component

Renders every entity with `Sphere` + `WorldMatrix` traits as one pair of
instanced draw calls (toon-shaded faces + edge lines) instead of a mesh
per sphere. Trait events are coalesced into a microtask flush, mirroring
the `WorldMatrix` system, so a burst of changes (one reconcile tick)
becomes a single batch of instance writes and one `invalidate()`.

The faces mesh is also the pointer-interaction surface: `InstancedMesh2`
raycasts per instance (skipping invisible ones) and stamps `instanceId`
on each hit, which `useInstancedEntityEvents` maps back to the entity.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { createRadixSort, InstancedMesh2 } from '@three.ez/instanced-mesh'
	import { T, useThrelte } from '@threlte/core'
	import {
		Color,
		EdgesGeometry,
		LineBasicMaterial,
		Matrix4,
		Sphere,
		SphereGeometry,
		Vector3,
	} from 'three'

	import { asColor } from '$lib/buffer'
	import { colors, darkenColor } from '$lib/color'
	import { traits, useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { createSurfaceMaterial } from '$lib/three/surfaceShading'

	import { composeSphereMatrix } from './composeSphereMatrix'
	import { useInstancedEntityEvents } from './hooks/useEntityEvents.svelte'
	import { useSurfaceMaterials } from './hooks/useSurfaceMaterials.svelte'

	const { invalidate, renderer } = useThrelte()
	const world = useWorld()
	const settings = useSettings()

	/**
	 * Shared unit geometries — every instance references these and sets its
	 * radius through the per-instance matrix scale, so resizing never rebuilds
	 * GPU buffers. Matches the geometry the former per-entity sphere renderer
	 * used: a radius-1 sphere with 16 × 12 segments.
	 */
	const unitSphere = new SphereGeometry(1, 16, 12)
	const unitSphereEdges = new EdgesGeometry(unitSphere, 0)

	/**
	 * Sphere meshes render transparent by default (`Opacity` trait absent → 0.7);
	 * per-instance alpha is written via `setOpacityAt`. The base color stays
	 * white so per-instance colors aren't tinted. Whole-object culling is
	 * disabled because the library culls per instance against a bounding sphere
	 * it derives from each instance matrix.
	 */
	const faceParameters = { transparent: true }
	const instancedSpheres = new InstancedMesh2(
		unitSphere,
		createSurfaceMaterial(settings.current.renderMode, faceParameters),
		{ renderer }
	)
	instancedSpheres.sortObjects = true
	instancedSpheres.customSort = createRadixSort(instancedSpheres)
	instancedSpheres.frustumCulled = false
	instancedSpheres.castShadow = true
	instancedSpheres.receiveShadow = true

	/**
	 * Keep raycasts on the library's linear (non-BVH) path, but neutralize
	 * its gate: the whole-object bounding sphere is computed once on the
	 * first raycast (usually before any spheres have streamed in) and never
	 * invalidated, leaving instances unhittable. Pin it open and let the
	 * per-instance early-outs do the pruning — for an always-animating
	 * scene this beats `computeBVH()`, which would re-insert every moving
	 * sphere into the tree on every kinematics tick.
	 */
	instancedSpheres.boundingSphere = new Sphere(new Vector3(), Infinity)

	useSurfaceMaterials([{ mesh: instancedSpheres, parameters: faceParameters }])

	const instancedSphereEdges = new InstancedMesh2(unitSphereEdges, new LineBasicMaterial(), {
		renderer,
	})
	instancedSphereEdges.frustumCulled = false

	/**
	 * `InstancedMesh2` extends `Mesh`, so on its own it would draw the edge
	 * geometry as triangles. Re-tagging the object makes the renderer emit
	 * `gl.LINES`; the library's instancing shader patch still applies because
	 * `LineBasicMaterial` compiles from the same chunk-based `basic` program
	 * its patched shader chunks target.
	 *
	 * @three.ez/instanced-mesh ^0.3.15 — patches the 'basic' shader chunks shared
	 * by MeshBasicMaterial and LineBasicMaterial. Re-validate if upgrading the library.
	 */
	Object.assign(instancedSphereEdges, { isMesh: false, isLine: true, isLineSegments: true })

	/**
	 * Faces and edges are separate meshes with independent free lists, so each
	 * entity tracks its faces id and edges id separately. `entityByInstanceId`
	 * is keyed by faces id — only the faces mesh raycasts (edges set
	 * `raycast={() => null}`), so a hit's `instanceId` is always a faces id.
	 */
	type InstanceIds = { face: number; edge: number }
	const instanceIdByEntity = new Map<Entity, InstanceIds>()
	const entityByInstanceId = new Map<number, Entity>()

	const events = useInstancedEntityEvents((event) =>
		event.instanceId === undefined ? undefined : entityByInstanceId.get(event.instanceId)
	)

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

	const writeAppearance = (entity: Entity, ids: InstanceIds) => {
		const color = resolveColor(entity)
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)
		const facesVisible = visible && !entity.has(traits.Wireframe)

		instancedSpheres.setColorAt(ids.face, color)
		instancedSpheres.setOpacityAt(ids.face, entity.get(traits.Opacity) ?? 0.7)
		instancedSpheres.setVisibilityAt(ids.face, facesVisible)

		instancedSphereEdges.setColorAt(ids.edge, darkenColor(color, 10))
		instancedSphereEdges.setVisibilityAt(ids.edge, visible)

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
		let face = -1
		instancedSpheres.addInstances(1, (_obj, index) => {
			face = index
		})
		instancedSpheres.setMatrixAt(face, matrix)

		let edge = -1
		instancedSphereEdges.addInstances(1, (_obj, index) => {
			edge = index
		})
		instancedSphereEdges.setMatrixAt(edge, matrix)

		const ids = { face, edge }
		instanceIdByEntity.set(entity, ids)
		entityByInstanceId.set(face, entity)
		writeAppearance(entity, ids)
	}

	const removeInstance = (entity: Entity, ids: InstanceIds) => {
		instanceIdByEntity.delete(entity)
		entityByInstanceId.delete(ids.face)
		instancedSpheres.removeInstances(ids.face)
		instancedSphereEdges.removeInstances(ids.edge)
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
			const ids = instanceIdByEntity.get(entity)

			if (entity.isAlive() && composeSphereMatrix(entity, matrix)) {
				if (ids === undefined) {
					addInstance(entity)
				} else {
					instancedSpheres.setMatrixAt(ids.face, matrix)
					instancedSphereEdges.setMatrixAt(ids.edge, matrix)
				}
			} else if (ids !== undefined) {
				removeInstance(entity, ids)
			}
		}

		for (const entity of dirtyAppearance) {
			const ids = instanceIdByEntity.get(entity)
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
	 * filter to sphere entities before touching the dirty sets. `instanceIdByEntity`
	 * catches entities whose `Sphere` trait was just removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Sphere) && !instanceIdByEntity.has(entity)) return
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
			world.onAdd(traits.InheritedInvisible, enqueueAppearance),
			world.onRemove(traits.InheritedInvisible, enqueueAppearance),
			world.onAdd(traits.ColliderHidden, enqueueAppearance),
			world.onRemove(traits.ColliderHidden, enqueueAppearance),
			world.onAdd(traits.Wireframe, enqueueAppearance),
			world.onRemove(traits.Wireframe, enqueueAppearance),
		]

		return () => {
			for (const unsub of unsubs) unsub()
			dirtyTransform.clear()
			dirtyAppearance.clear()
		}
	})
</script>

<T
	is={instancedSpheres}
	{...events}
/>

<T
	is={instancedSphereEdges}
	raycast={() => null}
/>
