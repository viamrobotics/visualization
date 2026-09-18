<!--
@component

Renders every entity with `Capsule` + `WorldMatrix` traits as four instanced
draw calls instead of a mesh trio per capsule. A capsule splits into one
open-ended cylinder body and two hemisphere caps (`l` is the *total* length, so
the body spans `l − 2r`), giving four meshes:

- toon-shaded cylinder bodies + their edge lines (one instance per capsule)
- toon-shaded hemisphere caps + their edge lines (two instances per capsule)

Trait events are coalesced into a microtask flush mirroring the `WorldMatrix`
system, so a burst of changes (one reconcile tick) becomes a single batch of
instance writes and one `invalidate()`.

Both face meshes are pointer-interaction surfaces: `InstancedMesh2` raycasts per
instance (skipping invisible ones) and stamps `instanceId` on each hit. A single
shared handler set is attached to both; `entityForEvent` reads the hit object to
pick the body or head id table and map the `instanceId` back to the entity.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { BufferGeometry } from 'three'

	import { createRadixSort, InstancedMesh2 } from '@three.ez/instanced-mesh'
	import { T, useThrelte } from '@threlte/core'
	import {
		Color,
		CylinderGeometry,
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

	import { composeCapsuleMatrices } from './composeCapsuleMatrices'
	import { useInstancedEntityEvents } from './hooks/useEntityEvents.svelte'
	import { useSurfaceMaterials } from './hooks/useSurfaceMaterials.svelte'

	const { invalidate, renderer } = useThrelte()
	const world = useWorld()
	const settings = useSettings()

	/**
	 * Shared unit geometries — every instance references these and sets its
	 * radius/length through the per-instance matrix scale, so resizing never
	 * rebuilds GPU buffers. Matches the geometry the former per-entity capsule
	 * renderer used: an open-ended cylinder along Z and a hemisphere rounded
	 * toward +Z, both with 16 radial segments.
	 */
	const unitCylinder = new CylinderGeometry(1, 1, 1, 16, 1, true)
	unitCylinder.rotateX(Math.PI / 2)
	const unitHemisphere = new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
	unitHemisphere.rotateX(Math.PI / 2)
	const unitCylinderEdges = new EdgesGeometry(unitCylinder, 0)
	const unitHemisphereEdges = new EdgesGeometry(unitHemisphere, 0)

	/**
	 * Build a faces mesh. Capsule meshes render transparent by default (`Opacity`
	 * trait absent → 0.7); per-instance alpha is written via `setOpacityAt`.
	 * Whole-object culling is disabled and the bounding sphere pinned open for
	 * the same reason as `Boxes.svelte`: the library culls and raycasts per
	 * instance, and its once-computed object sphere would otherwise gate an
	 * always-animating scene shut.
	 */
	const faceParameters = { transparent: true }

	const createFaces = (geometry: BufferGeometry) => {
		const mesh = new InstancedMesh2(
			geometry,
			createSurfaceMaterial(settings.current.renderMode, faceParameters),
			{ renderer }
		)
		mesh.sortObjects = true
		mesh.customSort = createRadixSort(mesh)
		mesh.frustumCulled = false
		mesh.boundingSphere = new Sphere(new Vector3(), Infinity)
		mesh.castShadow = true
		mesh.receiveShadow = true
		return mesh
	}

	/**
	 * Build an edges mesh. `InstancedMesh2` extends `Mesh`, so on its own it
	 * would draw the edge geometry as triangles; re-tagging the object makes the
	 * renderer emit `gl.LINES`. The library's instancing shader patch still
	 * applies because `LineBasicMaterial` compiles from the same chunk-based
	 * `basic` program its patched chunks target.
	 *
	 * @three.ez/instanced-mesh ^0.3.15 — patches the 'basic' shader chunks shared
	 * by MeshBasicMaterial and LineBasicMaterial. Re-validate if upgrading.
	 */
	const createEdges = (geometry: BufferGeometry) => {
		const mesh = new InstancedMesh2(geometry, new LineBasicMaterial(), { renderer })
		mesh.frustumCulled = false
		Object.assign(mesh, { isMesh: false, isLine: true, isLineSegments: true })
		return mesh
	}

	const instancedCapsuleBodies = createFaces(unitCylinder)
	const instancedCapsuleBodyEdges = createEdges(unitCylinderEdges)
	const instancedCapsuleHeads = createFaces(unitHemisphere)
	const instancedCapsuleHeadEdges = createEdges(unitHemisphereEdges)

	useSurfaceMaterials([
		{ mesh: instancedCapsuleBodies, parameters: faceParameters },
		{ mesh: instancedCapsuleHeads, parameters: faceParameters },
	])

	/**
	 * Faces and edges are separate meshes with independent free lists, and the
	 * caps mesh holds two instances per capsule, so each entity tracks all six
	 * ids. The body/head id tables are keyed by faces id — only the face meshes
	 * raycast (edges set `raycast={() => null}`), so a hit's `instanceId` is
	 * always a body or head faces id depending on which mesh was hit.
	 */
	interface InstanceIds {
		bodyFace: number
		bodyEdge: number
		headTopFace: number
		headTopEdge: number
		headBottomFace: number
		headBottomEdge: number
	}

	const instanceIdByEntity = new Map<Entity, InstanceIds>()
	const entityByBodyFaceId = new Map<number, Entity>()
	const entityByHeadFaceId = new Map<number, Entity>()

	const events = useInstancedEntityEvents((event) => {
		if (event.instanceId === undefined) return undefined
		return event.object === instancedCapsuleHeads
			? entityByHeadFaceId.get(event.instanceId)
			: entityByBodyFaceId.get(event.instanceId)
	})

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

	const writeAppearance = (entity: Entity, ids: InstanceIds) => {
		const color = resolveColor(entity)
		const edgeColor = darkenColor(color, 10)
		const opacity = entity.get(traits.Opacity) ?? 0.7
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)
		const wireframe = entity.has(traits.Wireframe)

		/**
		 * The cylinder collapses once `l ≤ 2r`; hide it so the two caps read as a
		 * sphere (mirrors the old `{#if midsection > 0}` guard). The caps stay
		 * visible with the entity.
		 */
		const capsule = entity.get(traits.Capsule)
		const bodyVisible = visible && capsule !== undefined && capsule.l - 2 * capsule.r > 0
		const bodyFacesVisible = bodyVisible && !wireframe
		const headFacesVisible = visible && !wireframe

		instancedCapsuleBodies.setColorAt(ids.bodyFace, color)
		instancedCapsuleBodies.setOpacityAt(ids.bodyFace, opacity)
		instancedCapsuleBodies.setVisibilityAt(ids.bodyFace, bodyFacesVisible)
		instancedCapsuleBodyEdges.setColorAt(ids.bodyEdge, edgeColor)
		instancedCapsuleBodyEdges.setVisibilityAt(ids.bodyEdge, bodyVisible)

		instancedCapsuleHeads.setColorAt(ids.headTopFace, color)
		instancedCapsuleHeads.setOpacityAt(ids.headTopFace, opacity)
		instancedCapsuleHeads.setVisibilityAt(ids.headTopFace, headFacesVisible)
		instancedCapsuleHeads.setColorAt(ids.headBottomFace, color)
		instancedCapsuleHeads.setOpacityAt(ids.headBottomFace, opacity)
		instancedCapsuleHeads.setVisibilityAt(ids.headBottomFace, headFacesVisible)

		instancedCapsuleHeadEdges.setColorAt(ids.headTopEdge, edgeColor)
		instancedCapsuleHeadEdges.setVisibilityAt(ids.headTopEdge, visible)
		instancedCapsuleHeadEdges.setColorAt(ids.headBottomEdge, edgeColor)
		instancedCapsuleHeadEdges.setVisibilityAt(ids.headBottomEdge, visible)

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
		let bodyFace = -1
		instancedCapsuleBodies.addInstances(1, (_obj, index) => {
			bodyFace = index
		})
		instancedCapsuleBodies.setMatrixAt(bodyFace, bodyMatrix)

		let bodyEdge = -1
		instancedCapsuleBodyEdges.addInstances(1, (_obj, index) => {
			bodyEdge = index
		})
		instancedCapsuleBodyEdges.setMatrixAt(bodyEdge, bodyMatrix)

		let headTopFace = -1
		instancedCapsuleHeads.addInstances(1, (_obj, index) => {
			headTopFace = index
		})
		instancedCapsuleHeads.setMatrixAt(headTopFace, headTopMatrix)

		let headBottomFace = -1
		instancedCapsuleHeads.addInstances(1, (_obj, index) => {
			headBottomFace = index
		})
		instancedCapsuleHeads.setMatrixAt(headBottomFace, headBottomMatrix)

		let headTopEdge = -1
		instancedCapsuleHeadEdges.addInstances(1, (_obj, index) => {
			headTopEdge = index
		})
		instancedCapsuleHeadEdges.setMatrixAt(headTopEdge, headTopMatrix)

		let headBottomEdge = -1
		instancedCapsuleHeadEdges.addInstances(1, (_obj, index) => {
			headBottomEdge = index
		})
		instancedCapsuleHeadEdges.setMatrixAt(headBottomEdge, headBottomMatrix)

		const ids = {
			bodyFace,
			bodyEdge,
			headTopFace,
			headTopEdge,
			headBottomFace,
			headBottomEdge,
		}
		instanceIdByEntity.set(entity, ids)
		entityByBodyFaceId.set(bodyFace, entity)
		entityByHeadFaceId.set(headTopFace, entity)
		entityByHeadFaceId.set(headBottomFace, entity)
		writeAppearance(entity, ids)
	}

	const removeInstance = (entity: Entity, ids: InstanceIds) => {
		instanceIdByEntity.delete(entity)
		entityByBodyFaceId.delete(ids.bodyFace)
		entityByHeadFaceId.delete(ids.headTopFace)
		entityByHeadFaceId.delete(ids.headBottomFace)
		instancedCapsuleBodies.removeInstances(ids.bodyFace)
		instancedCapsuleBodyEdges.removeInstances(ids.bodyEdge)
		instancedCapsuleHeads.removeInstances(ids.headTopFace, ids.headBottomFace)
		instancedCapsuleHeadEdges.removeInstances(ids.headTopEdge, ids.headBottomEdge)
	}

	/**
	 * Transform work (matrix/dimension changes, adds, removes) is tracked
	 * separately from appearance work (color/opacity/visibility) so a robot in
	 * motion only rewrites matrices, not the color textures.
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

			if (
				entity.isAlive() &&
				composeCapsuleMatrices(entity, bodyMatrix, headTopMatrix, headBottomMatrix)
			) {
				if (ids === undefined) {
					addInstance(entity)
				} else {
					instancedCapsuleBodies.setMatrixAt(ids.bodyFace, bodyMatrix)
					instancedCapsuleBodyEdges.setMatrixAt(ids.bodyEdge, bodyMatrix)
					instancedCapsuleHeads.setMatrixAt(ids.headTopFace, headTopMatrix)
					instancedCapsuleHeads.setMatrixAt(ids.headBottomFace, headBottomMatrix)
					instancedCapsuleHeadEdges.setMatrixAt(ids.headTopEdge, headTopMatrix)
					instancedCapsuleHeadEdges.setMatrixAt(ids.headBottomEdge, headBottomMatrix)
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
	 * filter to capsule entities before touching the dirty sets.
	 * `instanceIdByEntity` catches entities whose `Capsule` trait was just
	 * removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Capsule) && !instanceIdByEntity.has(entity)) return
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
	is={instancedCapsuleBodies}
	{...events}
/>

<T
	is={instancedCapsuleBodyEdges}
	raycast={() => null}
/>

<T
	is={instancedCapsuleHeads}
	{...events}
/>

<T
	is={instancedCapsuleHeadEdges}
	raycast={() => null}
/>
