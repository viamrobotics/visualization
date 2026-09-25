import { BufferAttribute, type BufferGeometry } from 'three'

/** `position` is absent because it is the one attribute every geometry already has. */
const OPTIONAL_ATTRIBUTES = [
	{ name: 'color', itemSize: 3, missing: 1 },
	{ name: 'uv', itemSize: 2, missing: 0 },
] as const

/** Substitutes `missing` for an attribute the geometry lacks, and unpacks one it stores differently. */
const setFloatAttribute = (
	geometry: BufferGeometry,
	name: string,
	itemSize: number,
	missing: number
): void => {
	const source = geometry.getAttribute(name)
	if (source !== undefined && source.itemSize === itemSize && !source.normalized) {
		return
	}

	const vertexCount = geometry.getAttribute('position').count
	const values = new Float32Array(vertexCount * itemSize).fill(missing)

	if (source !== undefined) {
		// `getComponent` undoes the source's normalization, whatever it was.
		for (let vertex = 0; vertex < vertexCount; vertex += 1) {
			for (let component = 0; component < itemSize; component += 1) {
				values[vertex * itemSize + component] = source.getComponent(vertex, component)
			}
		}
	}

	geometry.setAttribute(name, new BufferAttribute(values, itemSize))
}

/** Lists the vertices in order. Welds nothing, so it buys no sharing a geometry didn't already have. */
const setTrivialIndex = (geometry: BufferGeometry): void => {
	if (geometry.index !== null) {
		return
	}

	const vertexCount = geometry.getAttribute('position').count
	const indices = new Uint32Array(vertexCount)
	for (let vertex = 0; vertex < vertexCount; vertex += 1) {
		indices[vertex] = vertex
	}

	geometry.setIndex(new BufferAttribute(indices, 1))
}

/**
 * Rewrites `geometry` into the one layout a faces batch accepts: indexed, with
 * `position`, `normal`, `color` and `uv`, and nothing else.
 *
 * A `BatchedMesh` fixes its layout from the first geometry added and rejects
 * every later one that differs, down to each attribute's `itemSize` and
 * `normalized` flag (`_validateGeometry`). Meshes from RDK agree on none of
 * that, so each one is rebuilt rather than trusted.
 *
 * Two of the choices are not obvious:
 *
 * `uv` is carried even though no material samples it today. A textured mesh
 * arriving later cannot add the attribute to a batch that is already running,
 * and its material would declare `attribute vec2 uv`, read zeros, and sample a
 * single texel without erroring.
 *
 * Geometries converge on indexed rather than on non-indexed, which would mean
 * expanding shared vertices instead of inventing an index. Expanding costs
 * about three times the memory on a smooth mesh, and makes the GPU re-run the
 * vertex shader for vertices it could otherwise have reused. Inventing an index
 * costs 4 bytes per vertex, whatever the geometry looks like.
 *
 * Returns a new geometry. The caller owns it, and should dispose it once
 * `addGeometry` has copied it into the batch.
 */
export const toFacesBatchLayout = (geometry: BufferGeometry): BufferGeometry => {
	const converged = geometry.clone()

	const kept = new Set<string>([
		'position',
		'normal',
		...OPTIONAL_ATTRIBUTES.map(({ name }) => name),
	])
	for (const name of Object.keys(converged.attributes)) {
		if (!kept.has(name)) {
			converged.deleteAttribute(name)
		}
	}

	if (converged.getAttribute('normal') === undefined) {
		converged.computeVertexNormals()
	}

	for (const { name, itemSize, missing } of OPTIONAL_ATTRIBUTES) {
		setFloatAttribute(converged, name, itemSize, missing)
	}

	setTrivialIndex(converged)

	return converged
}
