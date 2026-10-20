import { BufferGeometry } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const stlLoader = new STLLoader()

/**
 * `STLLoader.parse` reads the triangle count as a uint32 at offset 80 before checking the length, so
 * anything shorter throws out of the `DataView`. RDK draws the same line in `newMeshFromSTLBytes`.
 */
const STL_MIN_BYTES = 84

/**
 * That count is trusted, so a truncated body throws well above `STL_MIN_BYTES`. Pre-checking would
 * mean re-deriving `isBinary`, which reads the same field.
 */
const parseOrEmpty = (input: string | ArrayBuffer): BufferGeometry => {
	try {
		return stlLoader.parse(input)
	} catch {
		return new BufferGeometry()
	}
}

/**
 * Counterpart to `parsePlyInput`; `STLLoader` sniffs ASCII versus binary itself. Short input answers
 * with an empty geometry rather than throwing: callers loop over a resource's geometries unguarded.
 */
export const parseStlInput = (mesh: string | Uint8Array): BufferGeometry => {
	// A string is base64, the shape a mesh takes over the JSON transports, not plain ASCII STL text.
	if (typeof mesh === 'string') {
		// `atob` throws `InvalidCharacterError` on malformed base64, ahead of the length check below.
		let decoded: string
		try {
			decoded = atob(mesh)
		} catch {
			return new BufferGeometry()
		}
		return decoded.length < STL_MIN_BYTES ? new BufferGeometry() : parseOrEmpty(decoded)
	}

	// An absent mesh is not a malformed one. RDK writes geometry with no triangles.
	if (mesh.byteLength < STL_MIN_BYTES) {
		return new BufferGeometry()
	}

	// The loader takes a whole ArrayBuffer, so a view into a larger one has to be cut out first.
	// Getting this wrong is silent on binary STL: `isBinary` stops matching and the parse returns
	// nothing.
	const whole = mesh.byteOffset === 0 && mesh.byteLength === mesh.buffer.byteLength

	return parseOrEmpty(
		whole
			? (mesh.buffer as ArrayBuffer)
			: (mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength) as ArrayBuffer)
	)
}
