import { describe, expect, it } from 'vitest'

import { parsePlyInput } from '../ply'

const VERTICES = new Float32Array([1, 2, 3, 4, 5, 6])

const binaryPly = (): Uint8Array => {
	const header =
		'ply\nformat binary_little_endian 1.0\nelement vertex 2\n' +
		'property float x\nproperty float y\nproperty float z\nend_header\n'
	const headerBytes = new TextEncoder().encode(header)
	const out = new Uint8Array(headerBytes.length + VERTICES.byteLength)
	out.set(headerBytes, 0)
	out.set(new Uint8Array(VERTICES.buffer), headerBytes.length)
	return out
}

const asciiPly = (): Uint8Array =>
	new TextEncoder().encode(
		'ply\nformat ascii 1.0\nelement vertex 2\n' +
			'property float x\nproperty float y\nproperty float z\nend_header\n' +
			'1 2 3\n4 5 6\n'
	)

/** Mirrors protobuf-es, which decodes a `bytes` field as a view over the wire buffer. */
const asWireView = (payload: Uint8Array): Uint8Array => {
	const wire = new Uint8Array(8 + payload.length + 4)
	wire.set(payload, 8)
	return wire.subarray(8, 8 + payload.length)
}

describe('parsePlyInput', () => {
	it('parses a standalone binary PLY', () => {
		const geometry = parsePlyInput(binaryPly())

		expect(geometry.getAttribute('position').count).toBe(2)
	})

	it('parses a binary PLY delivered as a subarray view', () => {
		const view = asWireView(binaryPly())
		expect(view.byteOffset).toBe(8)

		const geometry = parsePlyInput(view)

		expect(geometry.getAttribute('position').count).toBe(2)
		expect([...geometry.getAttribute('position').array]).toEqual([...VERTICES])
	})

	it('parses an ascii PLY delivered as a subarray view', () => {
		const geometry = parsePlyInput(asWireView(asciiPly()))

		expect(geometry.getAttribute('position').count).toBe(2)
	})

	it('returns empty geometry for empty mesh bytes', () => {
		const geometry = parsePlyInput(new Uint8Array())

		expect(geometry.getAttribute('position')).toBeUndefined()
	})
})
