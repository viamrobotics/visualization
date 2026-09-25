import { BufferAttribute, type BufferGeometry } from 'three'

/** Every attribute a faces batch carries, and the value invented where one is absent. */
const ATTRIBUTES = [
	{ name: 'position', itemSize: 3, missing: 0 },
	{ name: 'normal', itemSize: 3, missing: 0 },
	{ name: 'color', itemSize: 3, missing: 1 },
	{ name: 'uv', itemSize: 2, missing: 0 },
] as const

/**
 * The packings `MathUtils.denormalize` knows. It throws on anything else, so a
 * `normalized` flag on another type is read as raw values instead.
 */
const DENORMALIZABLE = new Set([
	Int8Array,
	Uint8Array,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
])

/**
 * Rewrites `name` as exactly `vertexCount` plain float entries of `itemSize`
 * components, substituting `missing` for anything the source does not supply.
 *
 * A batch fixes its layout from the first geometry added and rejects every
 * later one that differs, down to each attribute's `itemSize` and `normalized`
 * flag (`_validateGeometry`). It then copies each attribute by length, not by
 * the vertex count it reserved, so an attribute longer than `position` writes
 * past the reservation and into another geometry's space.
 */
const setFloatAttribute = (
	geometry: BufferGeometry,
	vertexCount: number,
	name: string,
	itemSize: number,
	missing: number
): void => {
	const source = geometry.getAttribute(name)
	if (
		source !== undefined &&
		source.itemSize === itemSize &&
		source.count === vertexCount &&
		!source.normalized
	) {
		return
	}

	const values = new Float32Array(vertexCount * itemSize).fill(missing)

	if (source !== undefined) {
		const denormalizes = source.normalized && DENORMALIZABLE.has(source.array.constructor as never)
		const shared = Math.min(source.count, vertexCount)

		for (let vertex = 0; vertex < shared; vertex += 1) {
			for (let component = 0; component < Math.min(source.itemSize, itemSize); component += 1) {
				values[vertex * itemSize + component] = denormalizes
					? source.getComponent(vertex, component)
					: source.array[vertex * source.itemSize + component]
			}
		}
	}

	geometry.setAttribute(name, new BufferAttribute(values, itemSize))
}

/**
 * Indexes `geometry` if it has no index, and rewrites one that points outside
 * its own vertices.
 *
 * `setGeometryAt` writes `vertexStart + index` into the shared buffer without a
 * range check, so an index past the geometry's own vertex count reads another
 * entity's data, and one past 65535 wraps. Outside a batch a corrupt index only
 * garbles its own mesh, and clamping keeps it that way.
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
		const indices = new Uint32Array(vertexCount)
		for (let vertex = 0; vertex < vertexCount; vertex += 1) {
			indices[vertex] = vertex
		}
		geometry.setIndex(new BufferAttribute(indices, 1))
		return
	}

	let outOfRange = false
	for (let entry = 0; entry < source.count; entry += 1) {
		const value = source.getX(entry)
		if (value < 0 || value > last) {
			outOfRange = true
			break
		}
	}

	if (!outOfRange) {
		return
	}

	const clamped = new Uint32Array(source.count)
	for (let entry = 0; entry < source.count; entry += 1) {
		clamped[entry] = Math.min(Math.max(source.getX(entry), 0), last)
	}
	geometry.setIndex(new BufferAttribute(clamped, 1))
}

/**
 * Rewrites `geometry` into the one layout a faces batch accepts: indexed, with
 * `position`, `normal`, `color` and `uv`, every one a plain non-normalized
 * float array of the same length, and nothing else.
 *
 * Meshes from RDK agree on none of that, and a batch rejects or silently
 * corrupts what does not match, so each geometry is rebuilt rather than
 * trusted. See `setFloatAttribute` and `setSafeIndex` for what each guards.
 *
 * `uv` is carried even though no material samples it today. A textured mesh
 * arriving later cannot add the attribute to a batch already running, and its
 * material would declare `attribute vec2 uv`, read zeros, and sample a single
 * texel without erroring.
 *
 * Returns a new geometry. The caller owns it, and should dispose it once
 * `addGeometry` has copied it into the batch.
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

	// Before `setSafeIndex`, so shared vertices are still shared and smooth
	// geometry averages its normals. An invented index would unshare every
	// vertex and flat-shade the mesh.
	if (converged.getAttribute('normal') === undefined) {
		converged.computeVertexNormals()
	}

	for (const { name, itemSize, missing } of ATTRIBUTES) {
		setFloatAttribute(converged, vertexCount, name, itemSize, missing)
	}

	setSafeIndex(converged, vertexCount)

	return converged
}
