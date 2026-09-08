<!--
@component

Renders every entity with `Cylinder` + `WorldMatrix` traits as instanced draw
calls (toon-shaded faces + edge lines).

`capped` is a different geometry rather than a different scale, so solid
cylinders and open tubes get a variant each.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { BufferGeometry } from 'three'

	import { createRadixSort, InstancedMesh2 } from '@three.ez/instanced-mesh'
	import { T, useThrelte } from '@threlte/core'
	import {
		Color,
		CylinderGeometry,
		DoubleSide,
		EdgesGeometry,
		FrontSide,
		LineBasicMaterial,
		Matrix4,
		type Side,
		Sphere,
		Vector3,
	} from 'three'

	import { asColor } from '$lib/buffer'
	import { colors, darkenColor } from '$lib/color'
	import { traits, useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { createSurfaceMaterial } from '$lib/three/surfaceShading'

	import { composeCylinderMatrix } from './composeCylinderMatrix'
	import { useInstancedEntityEvents } from './hooks/useEntityEvents.svelte'
	import { useSurfaceMaterials } from './hooks/useSurfaceMaterials.svelte'

	const { invalidate, renderer } = useThrelte()
	const world = useWorld()
	const settings = useSettings()

	/** Matches the radial resolution `Capsules.svelte` gives its cylindrical body. */
	const RADIAL_SEGMENTS = 16

	/**
	 * Shared unit geometries — every instance references these and sets its
	 * radius/length through the per-instance matrix scale, so resizing never
	 * rebuilds GPU buffers. Rotated onto Z because that is rdk's cylinder axis,
	 * the same correction `Capsules.svelte` applies.
	 */
	const unitCylinder = (capped: boolean) => {
		const geometry = new CylinderGeometry(1, 1, 1, RADIAL_SEGMENTS, 1, !capped)
		geometry.rotateX(Math.PI / 2)
		return geometry
	}

	/**
	 * Build a faces mesh. Cylinder meshes render transparent by default (`Opacity`
	 * trait absent → 0.7); per-instance alpha is written via `setOpacityAt`.
	 * Whole-object culling is disabled and the bounding sphere pinned open for the
	 * same reason as `Boxes.svelte`: the library culls and raycasts per instance,
	 * and its once-computed object sphere would otherwise gate an
	 * always-animating scene shut.
	 *
	 * An open tube has no cap to hide its far wall, so back-face culling would
	 * leave it looking like a half pipe. `side` is `DoubleSide` for that variant.
	 */
	const faceParameters = (side: Side) => ({ side, transparent: true })

	const createFaces = (geometry: BufferGeometry, side: Side) => {
		const mesh = new InstancedMesh2(
			geometry,
			createSurfaceMaterial(settings.current.renderMode, faceParameters(side)),
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
	 * Build an edges mesh. `InstancedMesh2` extends `Mesh`, so on its own it would
	 * draw the edge geometry as triangles; re-tagging the object makes the
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

	/**
	 * Faces and edges are separate meshes with independent free lists, so each
	 * entity tracks its faces id and edges id separately. `entityByFaceId` is
	 * keyed by faces id — only the faces mesh raycasts (edges set
	 * `raycast={() => null}`), so a hit's `instanceId` is always a faces id.
	 */
	interface Variant {
		faces: ReturnType<typeof createFaces>
		edges: ReturnType<typeof createEdges>
		entityByFaceId: Map<number, Entity>
	}

	const createVariant = (capped: boolean): Variant => {
		const geometry = unitCylinder(capped)
		return {
			faces: createFaces(geometry, capped ? FrontSide : DoubleSide),
			edges: createEdges(new EdgesGeometry(geometry, 0)),
			entityByFaceId: new Map(),
		}
	}

	const cappedVariant = createVariant(true)
	const openVariant = createVariant(false)

	const variantFor = (capped: boolean): Variant => (capped ? cappedVariant : openVariant)

	useSurfaceMaterials([
		{ mesh: cappedVariant.faces, parameters: faceParameters(FrontSide) },
		{ mesh: openVariant.faces, parameters: faceParameters(DoubleSide) },
	])

	/** `capped` is stored alongside the ids because it names which variant holds them. */
	interface InstanceIds {
		face: number
		edge: number
		capped: boolean
	}

	const instanceIdByEntity = new Map<Entity, InstanceIds>()

	const events = useInstancedEntityEvents((event) => {
		if (event.instanceId === undefined) return undefined
		const variant = event.object === openVariant.faces ? openVariant : cappedVariant
		return variant.entityByFaceId.get(event.instanceId)
	})

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
		const { faces, edges } = variantFor(ids.capped)
		const color = resolveColor(entity)
		const visible = !entity.has(traits.InheritedInvisible) && !entity.has(traits.ColliderHidden)
		const facesVisible = visible && !entity.has(traits.Wireframe)

		faces.setColorAt(ids.face, color)
		faces.setOpacityAt(ids.face, entity.get(traits.Opacity) ?? 0.7)
		faces.setVisibilityAt(ids.face, facesVisible)

		edges.setColorAt(ids.edge, darkenColor(color, 10))
		edges.setVisibilityAt(ids.edge, visible)

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
	const addInstance = (entity: Entity, capped: boolean) => {
		const variant = variantFor(capped)

		let face = -1
		variant.faces.addInstances(1, (_obj, index) => {
			face = index
		})
		variant.faces.setMatrixAt(face, matrix)

		let edge = -1
		variant.edges.addInstances(1, (_obj, index) => {
			edge = index
		})
		variant.edges.setMatrixAt(edge, matrix)

		const ids = { face, edge, capped }
		instanceIdByEntity.set(entity, ids)
		variant.entityByFaceId.set(face, entity)
		writeAppearance(entity, ids)
	}

	const removeInstance = (entity: Entity, ids: InstanceIds) => {
		const variant = variantFor(ids.capped)
		instanceIdByEntity.delete(entity)
		variant.entityByFaceId.delete(ids.face)
		variant.faces.removeInstances(ids.face)
		variant.edges.removeInstances(ids.edge)
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
			const ids = instanceIdByEntity.get(entity)
			const cylinder = entity.isAlive() ? entity.get(traits.Cylinder) : undefined

			if (cylinder && composeCylinderMatrix(entity, matrix)) {
				if (ids === undefined) {
					addInstance(entity, cylinder.capped)
				} else if (ids.capped === cylinder.capped) {
					const variant = variantFor(ids.capped)
					variant.faces.setMatrixAt(ids.face, matrix)
					variant.edges.setMatrixAt(ids.edge, matrix)
				} else {
					// The two variants are separate meshes, so a `capped` flip is a
					// move between them rather than a write to the instance in place.
					removeInstance(entity, ids)
					addInstance(entity, cylinder.capped)
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
	 * filter to cylinder entities before touching the dirty sets.
	 * `instanceIdByEntity` catches entities whose `Cylinder` trait was just
	 * removed.
	 */
	const enqueue = (dirty: Set<Entity>) => (entity: Entity) => {
		if (!entity.has(traits.Cylinder) && !instanceIdByEntity.has(entity)) return
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
	is={cappedVariant.faces}
	{...events}
/>

<T
	is={cappedVariant.edges}
	raycast={() => null}
/>

<T
	is={openVariant.faces}
	{...events}
/>

<T
	is={openVariant.edges}
	raycast={() => null}
/>
