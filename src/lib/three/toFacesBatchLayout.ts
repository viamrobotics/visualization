import { BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute } from 'three'

type SourceAttribute = BufferAttribute | InterleavedBufferAttribute

/** Every attribute a faces batch carries, and the value invented where one is absent. */
const ATTRIBUTES = [
	{ name: 'position', itemSize: 3, missing: 0 },
	{ name: 'normal', itemSize: 3, missing: 0 },
	{ name: 'color', itemSize: 3, missing: 1 },
	{ name: 'uv', itemSize: 2, missing: 0 },
] as const

/** The packings `MathUtils.denormalize` knows. It throws on any other. */
const DENORMALIZABLE = new Set([
	Int8Array,
	Uint8Array,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
])

const isInterleaved = (source: SourceAttribute): source is InterleavedBufferAttribute =>
	(source as InterleavedBufferAttribute).isInterleavedBufferAttribute === true

/**
 * Reads one component as a plain float.
 *
 * `getComponent` is the reader to prefer: it is the only one that accounts for
 * an interleaved attribute's stride and offset, and it denormalizes. It throws
 * for the two array types `MathUtils.denormalize` does not cover, so those read
 * through directly. Neither loader here produces one, and a direct read of a
 * normalized `Uint8ClampedArray` would be off by its scale factor.
 */
const readComponent = (source: SourceAttribute, vertex: number, component: number): number => {
	if (!source.normalized || DENORMALIZABLE.has(source.array.constructor as never)) {
		return source.getComponent(vertex, component)
	}

	return isInterleaved(source)
		? source.data.array[vertex * source.data.stride + source.offset + component]
		: source.array[vertex * source.itemSize + component]
}

/**
 * Rewrites `name` as exactly `vertexCount` plain float entries of `itemSize`
 * components, substituting `missing` for anything the source does not supply.
 *
 * A batch fixes its layout from the first geometry added and rejects every
 * later one whose `itemSize` or `normalized` flag differs
 * (`_validateGeometry`), and it copies by the attribute's own length rather
 * than the vertex count it reserved, so one longer than `position` writes into
 * the next geometry's space. The array type matters too, because
 * `_initializeGeometry` takes the batch's whole buffer type from the first
 * geometry: one stray `Uint16Array` would truncate every float written after
 * it, and `PLYLoader` builds exactly that for a `property uchar nx` normal.
 */
const setFloatAttribute = (
	geometry: BufferGeometry,
	vertexCount: number,
	name: string,
	itemSize: number,
	missing: number
): void => {
	const source = geometry.getAttribute(name) as SourceAttribute | undefined
	if (
		source !== undefined &&
		source.itemSize === itemSize &&
		source.count === vertexCount &&
		!source.normalized &&
		!isInterleaved(source) &&
		source.array instanceof Float32Array
	) {
		return
	}

	const values = new Float32Array(vertexCount * itemSize).fill(missing)

	if (source !== undefined) {
		const shared = Math.min(source.count, vertexCount)
		const components = Math.min(source.itemSize, itemSize)

		for (let vertex = 0; vertex < shared; vertex += 1) {
			for (let component = 0; component < components; component += 1) {
				values[vertex * itemSize + component] = readComponent(source, vertex, component)
			}
		}
	}

	geometry.setAttribute(name, new BufferAttribute(values, itemSize))
}

/**
 * Indexes `geometry` if it has none, and rewrites one that points outside its
 * own vertices.
 *
 * `setGeometryAt` writes `vertexStart + index` into the shared buffer with no
 * range check, so an index past the geometry's own vertex count reads another
 * entity's data, and one past 65535 wraps. A triangle with any such corner
 * collapses to zero area rather than being clamped corner by corner: a clamped
 * corner still spans the mesh, and a plausible-looking wrong face is worse to
 * debug than a missing one.
 *
 * An invented index welds nothing, so it buys no sharing the geometry did not
 * already have. It is still the cheap direction to converge on: expanding a
 * shared index instead runs to about three times the memory on a smooth mesh,
 * and makes the GPU re-run the vertex shader for vertices it could have reused.
 */
const setSafeIndex = (geometry: BufferGeometry, vertexCount: number): void => {
	const source = geometry.getIndex()
	const last = vertexCount - 1

	if (source === null) {
		const invented = new Uint32Array(vertexCount)
		for (let vertex = 0; vertex < vertexCount; vertex += 1) {
			invented[vertex] = vertex
		}
		geometry.setIndex(new BufferAttribute(invented, 1))
		return
	}

	const rebuilt = new Uint32Array(source.count)
	let corrupt = false

	for (let entry = 0; entry < source.count; entry += 1) {
		// Read through rather than `getX`, which denormalizes: a normalized index
		// would come back a fraction, pass the range test, and collapse the mesh.
		const value = source.array[entry]
		if (!(value >= 0 && value <= last)) {
			corrupt = true
		}
		rebuilt[entry] = value
	}

	if (!corrupt && !source.normalized) {
		return
	}

	for (let corner = 0; corner + 2 < source.count; corner += 3) {
		if (rebuilt[corner] > last || rebuilt[corner + 1] > last || rebuilt[corner + 2] > last) {
			rebuilt[corner] = 0
			rebuilt[corner + 1] = 0
			rebuilt[corner + 2] = 0
		}
	}

	// A tail too short to form a triangle draws nothing, but still has to be in
	// range, because the batch offsets every entry it copies.
	for (let entry = source.count - (source.count % 3); entry < source.count; entry += 1) {
		rebuilt[entry] = 0
	}

	geometry.setIndex(new BufferAttribute(rebuilt, 1))
}

/**
 * Rewrites `geometry` into the one layout a faces batch accepts: indexed, with
 * `position`, `normal`, `color` and `uv`, each a plain non-normalized
 * `Float32Array` of the same length, and nothing else.
 *
 * Meshes from RDK agree on none of that, and a batch either rejects or silently
 * corrupts what does not match, so every geometry is rebuilt rather than
 * trusted. See `setFloatAttribute` and `setSafeIndex` for what each guards.
 *
 * `uv` is carried even though no material samples it today. A textured mesh
 * arriving later cannot add the attribute to a batch already running, and its
 * material would declare `attribute vec2 uv`, read zeros, and sample a single
 * texel without erroring.
 *
 * Returns a new geometry. The caller owns it, and should dispose it once
 * `addGeometry` has copied it into the batch. Build any `EdgesGeometry` from
 * the result too, not from the source, or the outline is derived from the very
 * index this repaired.
 *
 * @throws If `geometry` has no `position` attribute, which is not a mesh.
 */
export const toFacesBatchLayout = (geometry: BufferGeometry): BufferGeometry => {
	const vertexCount = geometry.getAttribute('position')?.count
	if (vertexCount === undefined) {
		throw new Error('toFacesBatchLayout: geometry has no position attribute')
	}

	const converged = geometry.clone()

	const kept = new Set<string>(ATTRIBUTES.map(({ name }) => name))
	for (const name of Object.keys(converged.attributes)) {
		if (!kept.has(name)) {
			converged.deleteAttribute(name)
		}
	}

	// Ahead of the normals, which read through the index: an out-of-range corner
	// would otherwise read past `position` and write NaN into the shared buffer.
	setSafeIndex(converged, vertexCount)

	if (converged.getAttribute('normal') === undefined) {
		converged.computeVertexNormals()
	}

	for (const { name, itemSize, missing } of ATTRIBUTES) {
		setFloatAttribute(converged, vertexCount, name, itemSize, missing)
	}

	return converged
}
