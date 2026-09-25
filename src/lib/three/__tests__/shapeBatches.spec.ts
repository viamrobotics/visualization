import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	MeshBasicMaterial,
	SphereGeometry,
} from 'three'
import { describe, expect, it } from 'vitest'

import { createShapeBatches } from '../shapeBatches'
import { toFacesBatchLayout } from '../toFacesBatchLayout'

const createBatches = () => createShapeBatches(new MeshBasicMaterial())

const createLargeGeometry = (triangles: number): BufferGeometry => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(triangles * 9), 3))
	geometry.setAttribute('normal', new BufferAttribute(new Float32Array(triangles * 9), 3))
	return geometry
}

describe('toFacesBatchLayout', () => {
	it('drops the index, so every geometry in the batch agrees on having none', () => {
		expect(toFacesBatchLayout(new BoxGeometry(1, 1, 1)).index).toBeNull()
	})

	it('keeps position, normal and color and nothing else', () => {
		const flattened = toFacesBatchLayout(new BoxGeometry(1, 1, 1))
		expect(Object.keys(flattened.attributes).toSorted()).toEqual(['color', 'normal', 'position'])
	})

	it('invents white for a geometry with no color of its own', () => {
		const flattened = toFacesBatchLayout(new BoxGeometry(1, 1, 1))
		const color = flattened.getAttribute('color')

		expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([1, 1, 1])
	})

	it('unpacks a normalized color into plain floats, so the batch layouts agree', () => {
		const geometry = new BoxGeometry(1, 1, 1).toNonIndexed()
		const vertexCount = geometry.getAttribute('position').count
		geometry.setAttribute(
			'color',
			new BufferAttribute(new Uint8Array(vertexCount * 3).fill(255), 3, true)
		)

		const color = toFacesBatchLayout(geometry).getAttribute('color')

		expect(color.normalized).toBe(false)
		expect(color.getX(0)).toBe(1)
	})

	it('expands an indexed geometry to one vertex per corner', () => {
		const box = new BoxGeometry(1, 1, 1)
		const flattened = toFacesBatchLayout(box)
		expect(flattened.getAttribute('position').count).toBe(box.index?.count)
	})

	it('computes normals for a geometry that arrives without them', () => {
		const bare = new BufferGeometry()
		bare.setAttribute(
			'position',
			new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
		)

		expect(toFacesBatchLayout(bare).getAttribute('normal').count).toBe(3)
	})

	it('leaves the source geometry alone', () => {
		const box = new BoxGeometry(1, 1, 1)
		toFacesBatchLayout(box)
		expect(box.index).not.toBeNull()
		expect(box.getAttribute('uv')).toBeDefined()
	})
})

describe('registerMesh', () => {
	it('uploads a mesh and hands back slots that can be instanced', () => {
		const batches = createBatches()
		const slot = batches.registerMesh(new SphereGeometry(1, 8, 6))

		const ids = batches.addMesh(slot)

		expect(batches.faces.getGeometryIdAt(ids.face)).toBe(slot.faceGeometry)
		expect(batches.edges.getGeometryIdAt(ids.edge)).toBe(slot.edgeGeometry)
	})

	it('shares one upload between entities drawing the same geometry', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		expect(batches.registerMesh(geometry)).toEqual(batches.registerMesh(geometry))
	})

	it('gives distinct geometries distinct slots', () => {
		const batches = createBatches()

		const first = batches.registerMesh(new SphereGeometry(1, 8, 6))
		const second = batches.registerMesh(new BoxGeometry(2, 2, 2))

		expect(second.faceGeometry).not.toBe(first.faceGeometry)
	})

	it('grows the buffer for a mesh larger than everything allocated so far', () => {
		const batches = createBatches()
		const large = createLargeGeometry(20_000)

		const slot = batches.registerMesh(large)

		expect(batches.faces.getGeometryRangeAt(slot.faceGeometry)?.vertexCount).toBe(60_000)
	})
})

describe('releaseMesh', () => {
	it('keeps the upload while another entity still draws it', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		const slot = batches.registerMesh(geometry)
		batches.registerMesh(geometry)
		batches.releaseMesh(geometry)

		expect(() => batches.faces.getGeometryRangeAt(slot.faceGeometry)).not.toThrow()
	})

	it('frees the upload once the last entity drops it', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		const slot = batches.registerMesh(geometry)
		batches.releaseMesh(geometry)

		expect(() => batches.faces.getGeometryRangeAt(slot.faceGeometry)).toThrow()
	})

	it('re-registering after a release uploads again rather than reusing a dead slot', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		batches.registerMesh(geometry)
		batches.releaseMesh(geometry)
		const slot = batches.registerMesh(geometry)

		expect(() => batches.faces.getGeometryRangeAt(slot.faceGeometry)).not.toThrow()
	})

	it('ignores a geometry that was never registered', () => {
		const batches = createBatches()
		expect(() => batches.releaseMesh(new SphereGeometry(1, 8, 6))).not.toThrow()
	})
})
