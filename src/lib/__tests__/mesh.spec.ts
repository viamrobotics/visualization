import { describe, expect, it } from 'vitest'

import { meshContentType, parseMeshInput } from '$lib/mesh'

const asciiStl = `solid tri
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid tri
`

const asciiPly = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_index
end_header
0 0 0
1 0 0
0 1 0
3 0 1 2
`

const bytes = (text: string) => new TextEncoder().encode(text)

/**
 * Binary on purpose: the subarray cases below reach a text path for an ASCII mesh, which is decoded
 * from the view and so carries its own offset. Only the binary path reads the underlying buffer.
 */
const binaryStl = (triangles = 1): Uint8Array<ArrayBuffer> => {
	// 80-byte header, uint32 triangle count, then 50 bytes per triangle.
	const buffer = new ArrayBuffer(80 + 4 + 50 * triangles)
	const view = new DataView(buffer)
	view.setUint32(80, triangles, true)
	// Normal, then three vertices, as 12 little-endian floats. The remaining 2 bytes of each
	// triangle are the attribute count, which the loader ignores.
	const floats = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
	for (let triangle = 0; triangle < triangles; triangle += 1) {
		const start = 84 + triangle * 50
		for (const [i, value] of floats.entries()) view.setFloat32(start + i * 4, value, true)
	}
	return new Uint8Array(buffer)
}

const binaryPly = (): Uint8Array<ArrayBuffer> => {
	const header = bytes(`ply
format binary_little_endian 1.0
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_index
end_header
`)
	// Three xyz vertices, then one face: a uchar count followed by three int32 indices.
	const body = new ArrayBuffer(3 * 3 * 4 + 1 + 3 * 4)
	const view = new DataView(body)
	const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0]
	for (const [i, value] of vertices.entries()) view.setFloat32(i * 4, value, true)
	view.setUint8(36, 3)
	for (const [i, value] of [0, 1, 2].entries()) view.setInt32(37 + i * 4, value, true)

	const out = new Uint8Array(header.length + body.byteLength)
	out.set(header, 0)
	out.set(new Uint8Array(body), header.length)
	return out
}

// Mapped rather than spread: a spread passes one argument per byte and blows the call stack on a
// fixture of any size.
const base64 = (data: Uint8Array) =>
	btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(''))

describe('meshContentType', () => {
	it.each([
		['ply', 'ply'],
		['stl', 'stl'],
		['STL', 'stl'],
		['  Ply  ', 'ply'],
		['model/stl', 'stl'],
		['application/ply; charset=binary', 'ply'],
	])('reads %s as %s', (raw, expected) => {
		expect(meshContentType(raw)).toBe(expected)
	})

	it.each([['obj'], ['dae'], [''], [undefined]])('does not claim to handle %s', (raw) => {
		expect(meshContentType(raw)).toBeUndefined()
	})

	it.each([['meshes/ur20/collision/base.stl'], ['package://arm/link_1.stl'], ['/etc/thing.ply']])(
		'does not read a file path like %s as a content type',
		(raw) => {
			expect(meshContentType(raw)).toBeUndefined()
		}
	)
})

describe('parseMeshInput', () => {
	it('parses an stl mesh into real vertices', () => {
		const geometry = parseMeshInput(bytes(asciiStl), 'stl')
		expect(geometry.getAttribute('position').count).toBe(3)
	})

	it('parses a ply mesh into real vertices', () => {
		const geometry = parseMeshInput(bytes(asciiPly), 'ply')
		expect(geometry.getAttribute('position').count).toBe(3)
	})

	it.each([[undefined], [''], ['obj']])('falls back to ply for a content type of %s', (raw) => {
		const geometry = parseMeshInput(bytes(asciiPly), raw)
		expect(geometry.getAttribute('position').count).toBe(3)
	})

	it.each([['ply'], ['stl']])('returns an empty geometry for empty %s bytes', (contentType) => {
		expect(parseMeshInput(new Uint8Array(), contentType).getAttribute('position')).toBeUndefined()
	})

	it.each([
		['ascii', () => btoa(asciiStl)],
		['binary', () => base64(binaryStl())],
	])('accepts a base64 %s stl as well as bytes', (_label, encode) => {
		expect(parseMeshInput(encode(), 'stl').getAttribute('position').count).toBe(3)
	})

	it.each([
		['stl', binaryStl],
		['ply', binaryPly],
	])('parses a binary %s mesh into real vertices', (contentType, build) => {
		expect(parseMeshInput(build(), contentType).getAttribute('position').count).toBe(3)
	})

	it('reads the stl triangle count rather than assuming one', () => {
		expect(parseMeshInput(binaryStl(2), 'stl').getAttribute('position').count).toBe(6)
	})

	/**
	 * An unsliced view starts a binary loader four bytes early, and both answer that with an empty
	 * geometry rather than a throw, so this fails silently if the guard goes.
	 */
	it.each([
		['stl', binaryStl],
		['ply', binaryPly],
	])('parses a binary %s mesh held in a subarray', (contentType, build) => {
		const mesh = build()
		const padded = new Uint8Array(mesh.length + 8)
		padded.set(mesh, 4)
		const view = padded.subarray(4, 4 + mesh.length)

		expect(parseMeshInput(view, contentType).getAttribute('position').count).toBe(3)
	})

	it.each([[1], [19], [83]])(
		'returns an empty geometry for a %i byte stl rather than throwing',
		(length) => {
			expect(parseMeshInput(new Uint8Array(length), 'stl').getAttribute('position')).toBeUndefined()
		}
	)

	// Above the 84-byte guard, so the count at offset 80 is read and believed.
	it.each([
		['claims 100 triangles and carries none', 84, 100],
		['claims 2 triangles and carries 1', 84 + 50, 2],
	])(
		'returns an empty geometry for a binary stl that %s rather than throwing',
		(_label, length, claimed) => {
			const truncated = new Uint8Array(length)
			new DataView(truncated.buffer).setUint32(80, claimed, true)

			expect(parseMeshInput(truncated, 'stl').getAttribute('position')).toBeUndefined()
		}
	)

	it.each([
		['an empty string', ''],
		['a truncated base64 payload', btoa('solid t\nendsolid t\n')],
		['malformed base64', '!!!not base64!!!'],
	])('returns an empty geometry for %s rather than throwing', (_label, encoded) => {
		expect(parseMeshInput(encoded, 'stl').getAttribute('position')).toBeUndefined()
	})

	// The text path decodes from the view, so it was never at risk. Kept so the pair is
	// symmetric and a future change to the sniffing cannot quietly break it.
	it.each([
		['stl', asciiStl],
		['ply', asciiPly],
	])('parses an ascii %s mesh held in a subarray', (contentType, text) => {
		const mesh = bytes(text)
		const padded = new Uint8Array(mesh.length + 8)
		padded.set(mesh, 4)
		const view = padded.subarray(4, 4 + mesh.length)

		expect(parseMeshInput(view, contentType).getAttribute('position').count).toBe(3)
	})
})
