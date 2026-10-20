import type { BufferAttribute } from 'three'

import { describe, expect, it } from 'vitest'

import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { STRIDE } from '$lib/buffer'

import {
	createBufferGeometry,
	preAllocateBufferGeometry,
	updateBufferGeometry,
	updateBufferGeometryColors,
	writeBufferGeometryRange,
} from '../attribute'

const rgb = { colorFormat: ColorFormat.RGB }

/** What three.js will actually draw: `min(drawRange.count, position.count)`. */
const renderedVertexCount = (geometry: {
	drawRange: { count: number }
	getAttribute: (name: string) => { count: number } | undefined
}) => Math.min(geometry.drawRange.count, geometry.getAttribute('position')!.count)

describe('updateBufferGeometry', () => {
	it('draws only the new points when the cloud shrinks', () => {
		const geometry = createBufferGeometry(new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]))

		updateBufferGeometry(geometry, new Float32Array([9, 9, 9, 8, 8, 8]), rgb)

		expect(geometry.drawRange.count).toBe(2)
		expect(renderedVertexCount(geometry)).toBe(2)
	})

	it('reuses the existing attribute when the new cloud fits', () => {
		const geometry = createBufferGeometry(new Float32Array([1, 1, 1, 2, 2, 2]))
		const before = geometry.getAttribute('position') as BufferAttribute
		const version = before.version

		updateBufferGeometry(geometry, new Float32Array([9, 9, 9]), rgb)

		expect(geometry.getAttribute('position')).toBe(before)
		// `needsUpdate` is write-only in three.js, so the version bump is the signal.
		expect(before.version).toBeGreaterThan(version)
	})

	it('draws every point again after a shrink is followed by a grow', () => {
		const geometry = createBufferGeometry(new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]))

		updateBufferGeometry(geometry, new Float32Array([9, 9, 9]), rgb)
		updateBufferGeometry(geometry, new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]), rgb)

		expect(renderedVertexCount(geometry)).toBe(3)
	})

	it('drops the range cap when the attribute is reallocated', () => {
		const geometry = createBufferGeometry(new Float32Array([1, 1, 1]))

		updateBufferGeometry(geometry, new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]), rgb)

		expect(renderedVertexCount(geometry)).toBe(3)
	})

	it('invalidates the cached bounding sphere', () => {
		const geometry = createBufferGeometry(new Float32Array([1, 1, 1, 2, 2, 2]))
		geometry.computeBoundingSphere()
		expect(geometry.boundingSphere).not.toBeNull()

		updateBufferGeometry(geometry, new Float32Array([500, 500, 500, 600, 600, 600]), rgb)

		expect(geometry.boundingSphere).toBeNull()
	})
})

describe('updateBufferGeometryColors', () => {
	it('leaves positions and the draw range alone', () => {
		const geometry = preAllocateBufferGeometry(4, STRIDE.POSITIONS, {
			...rgb,
			colors: new Uint8Array(0),
		})
		writeBufferGeometryRange(geometry, new Float32Array([1, 1, 1, 2, 2, 2]), 0, rgb)
		expect(geometry.drawRange.count).toBe(2)

		updateBufferGeometryColors(geometry, {
			...rgb,
			colors: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
		})

		// Still the two written points — not the four the buffer has room for.
		expect(geometry.drawRange.count).toBe(2)
		expect(geometry.getAttribute('color').array.slice(0, 3)).toEqual(new Uint8Array([1, 2, 3]))
	})
})

describe('writeBufferGeometryRange', () => {
	it('extends the draw range in vertices as chunks arrive', () => {
		const geometry = preAllocateBufferGeometry(4, STRIDE.POSITIONS, rgb)

		writeBufferGeometryRange(geometry, new Float32Array([1, 1, 1, 2, 2, 2]), 0, rgb)
		expect(geometry.drawRange.count).toBe(2)

		writeBufferGeometryRange(geometry, new Float32Array([3, 3, 3, 4, 4, 4]), 2, rgb)
		expect(geometry.drawRange.count).toBe(4)
		expect(renderedVertexCount(geometry)).toBe(4)
	})

	it('invalidates the bounding sphere so a growing cloud is not culled', () => {
		const geometry = preAllocateBufferGeometry(4, STRIDE.POSITIONS, rgb)
		writeBufferGeometryRange(geometry, new Float32Array([1, 1, 1]), 0, rgb)
		geometry.computeBoundingSphere()

		writeBufferGeometryRange(geometry, new Float32Array([900, 900, 900]), 1, rgb)

		expect(geometry.boundingSphere).toBeNull()
	})
})
