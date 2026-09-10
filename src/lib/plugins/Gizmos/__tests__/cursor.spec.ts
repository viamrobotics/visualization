import { createWorld, type Entity } from 'koota'
import { type Intersection, Mesh, Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { cursorHit, cursorPoint, isUsableHit } from '../cursor'

const makeIntersection = (
	object: Object3D,
	point = new Vector3(1, 2, 3),
	face?: { normal: Vector3 }
): Intersection =>
	({
		object,
		point,
		distance: 0,
		face,
	}) as unknown as Intersection

describe('isUsableHit', () => {
	it('accepts a hit on a visible mesh', () => {
		const mesh = new Mesh()
		expect(isUsableHit(makeIntersection(mesh))).toBe(true)
	})

	it('rejects a hit under an invisible ancestor', () => {
		const parent = new Object3D()
		parent.visible = false
		const mesh = new Mesh()
		parent.add(mesh)
		expect(isUsableHit(makeIntersection(mesh))).toBe(false)
	})

	it('rejects a hit inside the ignored entity subtree', () => {
		const world = createWorld()
		const entity = world.spawn() as Entity
		const ancestor = new Object3D()
		// Entity renderers stamp the numeric entity id into Object3D.name at runtime,
		// even though Three types it as a string.
		;(ancestor as unknown as { name: Entity }).name = entity
		const mesh = new Mesh()
		ancestor.add(mesh)

		expect(isUsableHit(makeIntersection(mesh), entity)).toBe(false)
	})

	it('accepts a hit inside a different entity subtree', () => {
		const world = createWorld()
		const entity = world.spawn() as Entity
		const other = world.spawn() as Entity
		const ancestor = new Object3D()
		;(ancestor as unknown as { name: Entity }).name = entity
		const mesh = new Mesh()
		ancestor.add(mesh)

		expect(isUsableHit(makeIntersection(mesh), other)).toBe(true)
	})
})

describe('cursorPoint', () => {
	it('returns a clone of the first usable hit point, not the first hit', () => {
		const invisible = new Mesh()
		invisible.visible = false
		const usablePoint = new Vector3(5, 6, 7)
		const usable = new Mesh()

		const result = cursorPoint([
			makeIntersection(invisible, new Vector3(9, 9, 9)),
			makeIntersection(usable, usablePoint),
		])

		expect(result?.equals(usablePoint)).toBe(true)
		expect(result).not.toBe(usablePoint)
	})

	it('returns undefined when no intersection is usable', () => {
		const mesh = new Mesh()
		mesh.visible = false
		expect(cursorPoint([makeIntersection(mesh)])).toBeUndefined()
		expect(cursorPoint([])).toBeUndefined()
	})

	it('returns a fresh vector on every call', () => {
		const mesh = new Mesh()
		const intersections = [makeIntersection(mesh, new Vector3(1, 1, 1))]
		const first = cursorPoint(intersections)
		const second = cursorPoint(intersections)
		expect(first).not.toBe(second)
	})
})

describe('cursorHit', () => {
	it('transforms the face normal into world space', () => {
		const mesh = new Mesh()
		mesh.matrixWorld.identity()
		const result = cursorHit([
			makeIntersection(mesh, new Vector3(0, 0, 0), { normal: new Vector3(0, 1, 0) }),
		])
		expect(result?.normal.y).toBeCloseTo(1)
		expect(result?.normal.length()).toBeCloseTo(1)
	})

	it('falls back to +Z when the hit has no face', () => {
		const mesh = new Mesh()
		const result = cursorHit([makeIntersection(mesh)])
		expect(result?.normal.equals(new Vector3(0, 0, 1))).toBe(true)
	})

	it('returns fresh position and normal vectors on every call', () => {
		const mesh = new Mesh()
		const intersections = [
			makeIntersection(mesh, new Vector3(1, 1, 1), { normal: new Vector3(0, 1, 0) }),
		]
		const first = cursorHit(intersections)
		const second = cursorHit(intersections)
		expect(first?.position).not.toBe(second?.position)
		expect(first?.normal).not.toBe(second?.normal)
	})
})
