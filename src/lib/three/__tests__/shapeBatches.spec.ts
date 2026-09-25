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

describe('toFacesBatchLayout, converging what a batch would reject or misread', () => {
	it('rebuilds a normalized normal, which a batch rejects outright', () => {
		const box = new BoxGeometry(1, 1, 1)
		const vertexCount = box.getAttribute('position').count
		box.setAttribute(
			'normal',
			new BufferAttribute(new Int16Array(vertexCount * 3).fill(32767), 3, true)
		)

		const normal = toFacesBatchLayout(box).getAttribute('normal')

		expect(normal.normalized).toBe(false)
		expect(normal.getX(0)).toBe(1)
	})

	it('truncates an attribute longer than position, which would overrun the batch buffer', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
		geometry.setAttribute('normal', new BufferAttribute(new Float32Array(3000), 3))

		expect(toFacesBatchLayout(geometry).getAttribute('normal').count).toBe(3)
	})

	it('pads an attribute shorter than position rather than reading past it', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(18), 3))
		geometry.setAttribute('color', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0]), 3))

		const color = toFacesBatchLayout(geometry).getAttribute('color')

		expect(color.count).toBe(6)
		expect(color.getX(5)).toBe(1)
	})

	it('clamps an index pointing past its own vertices, which would read another entity', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
		geometry.setIndex(new BufferAttribute(new Uint32Array([0, 1, 70_000]), 1))

		expect(toFacesBatchLayout(geometry).index?.getX(2)).toBe(2)
	})

	it('leaves an in-range index untouched', () => {
		const box = new BoxGeometry(1, 1, 1)
		expect(toFacesBatchLayout(box).index?.getX(5)).toBe(box.index?.getX(5))
	})

	it('rejects a geometry with no position, which is not a mesh', () => {
		expect(() => toFacesBatchLayout(new BufferGeometry())).toThrow(/no position attribute/)
	})
})

describe('toFacesBatchLayout', () => {
	it('keeps an existing index, so shared vertices are not expanded', () => {
		const box = new BoxGeometry(1, 1, 1)
		expect(toFacesBatchLayout(box).index?.count).toBe(box.index?.count)
	})

	it('keeps the vertex count of an indexed geometry', () => {
		const box = new BoxGeometry(1, 1, 1)
		expect(toFacesBatchLayout(box).getAttribute('position').count).toBe(24)
	})

	it('invents an index for a geometry without one, so the batch agrees on having them', () => {
		const flat = new BoxGeometry(1, 1, 1).toNonIndexed()
		const indexed = toFacesBatchLayout(flat)

		expect(indexed.index?.count).toBe(36)
		expect(indexed.index?.getX(5)).toBe(5)
	})

	it('keeps position, normal, color and uv and nothing else', () => {
		const converged = toFacesBatchLayout(new BoxGeometry(1, 1, 1))
		expect(Object.keys(converged.attributes).toSorted()).toEqual([
			'color',
			'normal',
			'position',
			'uv',
		])
	})

	it('invents zeroed uv for a geometry with none, so a textured mesh can join later', () => {
		const bare = new BufferGeometry()
		bare.setAttribute(
			'position',
			new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
		)

		const uv = toFacesBatchLayout(bare).getAttribute('uv')

		expect(uv.itemSize).toBe(2)
		expect([uv.getX(0), uv.getY(0)]).toEqual([0, 0])
	})

	it('keeps the uv a geometry arrives with', () => {
		const box = new BoxGeometry(1, 1, 1)
		const source = box.getAttribute('uv')

		const uv = toFacesBatchLayout(box).getAttribute('uv')

		expect(uv.getX(3)).toBe(source.getX(3))
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

	it('computes normals for a geometry that arrives without them', () => {
		const bare = new BufferGeometry()
		bare.setAttribute(
			'position',
			new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
		)

		expect(toFacesBatchLayout(bare).getAttribute('normal').count).toBe(3)
	})

	it('leaves the source geometry alone', () => {
		const flat = new BoxGeometry(1, 1, 1).toNonIndexed()

		toFacesBatchLayout(flat)

		expect(flat.index).toBeNull()
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

	it('grows the vertex buffer for a mesh larger than everything allocated so far', () => {
		const batches = createBatches()

		const slot = batches.registerMesh(createLargeGeometry(20_000))

		expect(batches.faces.getGeometryRangeAt(slot.faceGeometry)?.vertexCount).toBe(60_000)
	})

	it('grows the index buffer alongside it', () => {
		const batches = createBatches()

		const slot = batches.registerMesh(createLargeGeometry(20_000))

		expect(batches.faces.getGeometryRangeAt(slot.faceGeometry)?.indexCount).toBe(60_000)
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

	it('re-registering after a release uploads the geometry again', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)
		const vertexCount = geometry.getAttribute('position').count

		batches.registerMesh(geometry)
		batches.releaseMesh(geometry)
		const slot = batches.registerMesh(geometry)

		// `deleteGeometry` recycles ids, so the slot number alone proves nothing.
		expect(batches.faces.getGeometryRangeAt(slot.faceGeometry)?.vertexCount).toBe(vertexCount)
	})

	it('ignores a geometry that was never registered', () => {
		const batches = createBatches()
		expect(() => batches.releaseMesh(new SphereGeometry(1, 8, 6))).not.toThrow()
	})
})
