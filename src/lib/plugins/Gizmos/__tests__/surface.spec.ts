import { createWorld } from 'koota'
import { Mesh, Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { findSurfaceHit } from '../surface'

describe('findSurfaceHit', () => {
	it('resolves a hit on a Box entity to that entity', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Box({ x: 1, y: 1, z: 1 }))

		const mesh = new Mesh()
		;(mesh as unknown as { name: typeof entity }).name = entity

		const point = new Vector3(1, 2, 3)
		const hit = findSurfaceHit(world, [{ object: mesh, point, distance: 0 } as never])

		expect(hit?.entity).toBe(entity)
		expect(hit?.position.equals(point)).toBe(true)
	})

	it('returns undefined when no ancestor carries a surface trait', () => {
		const world = createWorld()
		const mesh = new Mesh()

		const hit = findSurfaceHit(world, [
			{ object: mesh, point: new Vector3(), distance: 0 } as never,
		])

		expect(hit).toBeUndefined()
	})

	it('skips an invisible hit in favour of a later usable one', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Sphere({ r: 1 }))

		const invisibleMesh = new Mesh()
		invisibleMesh.visible = false
		;(invisibleMesh as unknown as { name: typeof entity }).name = entity

		const usableParent = new Object3D()
		;(usableParent as unknown as { name: typeof entity }).name = entity
		const usableMesh = new Mesh()
		usableParent.add(usableMesh)

		const hit = findSurfaceHit(world, [
			{ object: invisibleMesh, point: new Vector3(9, 9, 9), distance: 0 } as never,
			{ object: usableMesh, point: new Vector3(1, 1, 1), distance: 1 } as never,
		])

		expect(hit?.entity).toBe(entity)
		expect(hit?.position.equals(new Vector3(1, 1, 1))).toBe(true)
	})

	it('returns a clone of the intersection point, not the original vector', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Box({ x: 1, y: 1, z: 1 }))
		const mesh = new Mesh()
		;(mesh as unknown as { name: typeof entity }).name = entity

		const point = new Vector3(4, 5, 6)
		const hit = findSurfaceHit(world, [{ object: mesh, point, distance: 0 } as never])

		expect(hit?.position).not.toBe(point)
		hit?.position.set(0, 0, 0)
		expect(point.equals(new Vector3(4, 5, 6))).toBe(true)
	})

	it('walks parents to find the surface entity', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Sphere({ r: 1 }))

		const parent = new Object3D()
		;(parent as unknown as { name: typeof entity }).name = entity
		const childMesh = new Mesh()
		parent.add(childMesh)

		const hit = findSurfaceHit(world, [
			{ object: childMesh, point: new Vector3(), distance: 0 } as never,
		])

		expect(hit?.entity).toBe(entity)
	})
})
