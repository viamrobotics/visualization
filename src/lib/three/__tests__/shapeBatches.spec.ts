import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	InterleavedBuffer,
	InterleavedBufferAttribute,
	Matrix4,
	MeshBasicMaterial,
	SphereGeometry,
	Vector4,
} from 'three'
import { describe, expect, it } from 'vitest'

import { createShapeBatches } from '../shapeBatches'
import { toFacesBatchLayout } from '../toFacesBatchLayout'

const createBatches = () => createShapeBatches((parameters) => new MeshBasicMaterial(parameters))

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

	it('collapses a triangle indexing past its own vertices, which would read another entity', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3))
		geometry.setIndex(new BufferAttribute(new Uint32Array([0, 1, 70_000]), 1))

		const index = toFacesBatchLayout(geometry).index

		expect([index?.getX(0), index?.getX(1), index?.getX(2)]).toEqual([0, 0, 0])
	})

	it('rebuilds a normalized index, which would otherwise read back as a fraction', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
		geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1, true))

		const index = toFacesBatchLayout(geometry).index

		expect(index?.normalized).toBe(false)
		expect([index?.getX(0), index?.getX(1), index?.getX(2)]).toEqual([0, 1, 2])
	})

	it('rebuilds a non-normalized integer attribute, which would retype the whole batch buffer', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
		geometry.setAttribute(
			'normal',
			new BufferAttribute(new Uint8Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3)
		)

		const normal = toFacesBatchLayout(geometry).getAttribute('normal')

		expect(normal.array).toBeInstanceOf(Float32Array)
		expect(normal.getZ(0)).toBe(1)
	})

	it('reads an interleaved attribute at its own stride and offset', () => {
		const geometry = new BufferGeometry()
		const interleaved = new InterleavedBuffer(
			new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 1]),
			6
		)
		geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
		geometry.setAttribute('color', new InterleavedBufferAttribute(interleaved, 3, 3))

		const color = toFacesBatchLayout(geometry).getAttribute('color')

		expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([1, 0, 0])
		expect([color.getX(2), color.getY(2), color.getZ(2)]).toEqual([0, 0, 1])
	})

	it('derives outlines from the repaired geometry, not the corrupt source', () => {
		const batches = createBatches()
		const geometry = new BufferGeometry()
		geometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3)
		)
		geometry.setIndex(new BufferAttribute(new Uint32Array([0, 1, 2, 0, 2, 999]), 1))

		batches.registerMesh(geometry)
		const positions = batches.opaque.edges.geometry.getAttribute('position').array

		expect(positions.some((value) => Number.isNaN(value))).toBe(false)
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

		expect(batches.opaque.faces.getGeometryIdAt(ids.face)).toBe(slot.opaque.faceGeometry)
		expect(batches.opaque.edges.getGeometryIdAt(ids.edge)).toBe(slot.opaque.edgeGeometry)
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

		expect(second.opaque.faceGeometry).not.toBe(first.opaque.faceGeometry)
	})

	it('grows the vertex buffer for a mesh larger than everything allocated so far', () => {
		const batches = createBatches()

		const slot = batches.registerMesh(createLargeGeometry(20_000))

		expect(batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)?.vertexCount).toBe(
			60_000
		)
	})

	it('grows the index buffer alongside it', () => {
		const batches = createBatches()

		const slot = batches.registerMesh(createLargeGeometry(20_000))

		expect(batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)?.indexCount).toBe(
			60_000
		)
	})
})

describe('releaseMesh', () => {
	it('keeps the upload while another entity still draws it', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		const slot = batches.registerMesh(geometry)
		batches.registerMesh(geometry)
		batches.releaseMesh(geometry)

		expect(() => batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)).not.toThrow()
	})

	it('frees the upload once the last entity drops it', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)

		const slot = batches.registerMesh(geometry)
		batches.releaseMesh(geometry)

		expect(() => batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)).toThrow()
	})

	it('re-registering after a release uploads the geometry again', () => {
		const batches = createBatches()
		const geometry = new SphereGeometry(1, 8, 6)
		const vertexCount = geometry.getAttribute('position').count

		batches.registerMesh(geometry)
		batches.releaseMesh(geometry)
		const slot = batches.registerMesh(geometry)

		// `deleteGeometry` recycles ids, so the slot number alone proves nothing.
		expect(batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)?.vertexCount).toBe(
			vertexCount
		)
	})

	it('ignores a geometry that was never registered', () => {
		const batches = createBatches()
		expect(() => batches.releaseMesh(new SphereGeometry(1, 8, 6))).not.toThrow()
	})
})

describe('swapping an entity geometry, the sequence `Mesh.svelte` runs on a mesh update', () => {
	/**
	 * Two entities share the mesh on purpose. With a single holder,
	 * `deleteGeometry` force-deletes the instances itself, which hides whether
	 * the caller released its own.
	 */
	const swapOneOfTwoSharers = (
		batches: ReturnType<typeof createBatches>,
		from: BufferGeometry,
		to: BufferGeometry
	) => {
		batches.addMesh(batches.registerMesh(from))
		const swapping = batches.addMesh(batches.registerMesh(from))

		batches.release(swapping)
		batches.releaseMesh(from)
		return batches.addMesh(batches.registerMesh(to))
	}

	it('leaves one instance per entity, not a leaked third', () => {
		const batches = createBatches()

		swapOneOfTwoSharers(batches, new SphereGeometry(1, 8, 6), new BoxGeometry(2, 2, 2))

		expect(batches.opaque.faces.instanceCount).toBe(2)
	})

	it('leaves one outline instance per entity too', () => {
		const batches = createBatches()

		swapOneOfTwoSharers(batches, new SphereGeometry(1, 8, 6), new BoxGeometry(2, 2, 2))

		expect(batches.opaque.edges.instanceCount).toBe(2)
	})

	it('points the new instance at the new geometry', () => {
		const batches = createBatches()
		const replacement = new BoxGeometry(2, 2, 2)

		const ids = swapOneOfTwoSharers(batches, new SphereGeometry(1, 8, 6), replacement)

		const range = batches.opaque.faces.getGeometryRangeAt(
			batches.opaque.faces.getGeometryIdAt(ids.face)
		)
		expect(range?.vertexCount).toBe(replacement.getAttribute('position').count)
	})

	it('keeps the upload alive for the entity that did not swap', () => {
		const batches = createBatches()
		const shared = new SphereGeometry(1, 8, 6)

		swapOneOfTwoSharers(batches, shared, new BoxGeometry(2, 2, 2))

		const slot = batches.registerMesh(shared)
		expect(batches.opaque.faces.getGeometryRangeAt(slot.opaque.faceGeometry)?.vertexCount).toBe(
			shared.getAttribute('position').count
		)
	})
})

describe('setAppearance, moving a shape between the opaque and translucent passes', () => {
	const placedBox = () => {
		const batches = createBatches()
		const ids = batches.add('box')
		batches.setMatrix(ids, new Matrix4().makeTranslation(1, 2, 3))
		batches.setAppearance(ids, new Color('red'), 1, true)
		return { batches, ids }
	}

	const fadeTo = (opacity: number) => {
		const placed = placedBox()
		placed.batches.setAppearance(placed.ids, new Color('red'), opacity, true)
		return placed
	}

	it('puts an opaque shape in the opaque pass', () => {
		const { ids } = placedBox()

		expect(ids.pass).toBe('opaque')
	})

	it('moves the face out of the opaque pass once opacity drops below 1', () => {
		const { batches } = fadeTo(0.5)

		expect(batches.opaque.faces.instanceCount).toBe(0)
		expect(batches.translucent.faces.instanceCount).toBe(1)
	})

	it('moves the outline with its face', () => {
		const { batches } = fadeTo(0.5)

		expect(batches.opaque.edges.instanceCount).toBe(0)
		expect(batches.translucent.edges.instanceCount).toBe(1)
	})

	it('keeps the face where it was placed', () => {
		const { batches, ids } = fadeTo(0.5)

		const position = batches.translucent.faces.getMatrixAt(ids.face, new Matrix4())
		expect(position.elements.slice(12, 15)).toEqual([1, 2, 3])
	})

	it('keeps the outline where it was placed', () => {
		const { batches, ids } = fadeTo(0.5)

		const position = batches.translucent.edges.getMatrixAt(ids.edge, new Matrix4())
		expect(position.elements.slice(12, 15)).toEqual([1, 2, 3])
	})

	it('keeps drawing the same geometry in the new pass', () => {
		const { batches, ids } = fadeTo(0.5)

		const range = batches.translucent.faces.getGeometryRangeAt(
			batches.translucent.faces.getGeometryIdAt(ids.face)
		)
		expect(range?.vertexCount).toBe(24)
	})

	it('writes the color and opacity into the new pass', () => {
		const { batches, ids } = fadeTo(0.5)

		const color = batches.translucent.faces.getColorAt(ids.face, new Vector4())
		expect(color.toArray()).toEqual([1, 0, 0, 0.5])
	})

	it('moves the shape back to the opaque pass at full opacity', () => {
		const { batches, ids } = fadeTo(0.5)

		batches.setAppearance(ids, new Color('red'), 1, true)

		expect(ids.pass).toBe('opaque')
		expect(batches.translucent.faces.instanceCount).toBe(0)
	})

	it('resolves a pointer hit on the new pass to the same handle', () => {
		const { batches, ids } = fadeTo(0.5)

		expect(batches.instanceAt(batches.translucent.faces, ids.face)).toBe(ids)
	})

	it('stops resolving a pointer hit on the slot it left', () => {
		const { batches, ids } = placedBox()
		const vacated = ids.face

		batches.setAppearance(ids, new Color('red'), 0.5, true)

		expect(batches.instanceAt(batches.opaque.faces, vacated)).toBeUndefined()
	})
})

describe('instanceAt', () => {
	it('tells apart two shapes holding the same instance id in different passes', () => {
		const batches = createBatches()
		const solid = batches.add('box')
		const glass = batches.add('sphere')
		batches.setAppearance(glass, new Color('white'), 0.5, true)

		expect([solid.face, glass.face]).toEqual([0, 0])
		expect(batches.instanceAt(batches.opaque.faces, 0)).toBe(solid)
		expect(batches.instanceAt(batches.translucent.faces, 0)).toBe(glass)
	})

	it('resolves nothing for an object that is not a faces batch', () => {
		const batches = createBatches()
		batches.add('box')

		expect(batches.instanceAt(batches.opaque.edges, 0)).toBeUndefined()
	})
})

describe('createShapeBatches, pass draw order', () => {
	it('creates opaque outlines after their faces, so an outline wins the depth tie with its own face', () => {
		const batches = createBatches()

		expect(batches.opaque.edges.id).toBeGreaterThan(batches.opaque.faces.id)
	})

	it('creates translucent outlines before their faces, so a translucent face in front blends over them', () => {
		const batches = createBatches()

		expect(batches.translucent.edges.id).toBeLessThan(batches.translucent.faces.id)
	})

	it('draws opaque faces in instance order, so an exact depth tie resolves the same from every camera angle', () => {
		const batches = createBatches()

		expect(batches.opaque.faces.sortObjects).toBe(false)
	})

	it('sorts translucent outlines back to front, so overlapping ones blend in order', () => {
		const batches = createBatches()

		expect(batches.translucent.edges.sortObjects).toBe(true)
	})
})
