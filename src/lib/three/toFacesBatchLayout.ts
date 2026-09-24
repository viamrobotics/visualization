import { BufferAttribute, type BufferGeometry } from 'three'

const COLOR_ITEM_SIZE = 3

/**
 * Gives `geometry` a plain float RGB `color` attribute, rebuilding one that is
 * packed differently and inventing white where there is none.
 *
 * One batch means one material, so `vertexColors` is on for every instance in
 * it. A geometry without the attribute would read garbage, and `PLYLoader` can
 * hand back colors normalized or with an alpha channel, which
 * `_validateGeometry` rejects against a batch expecting neither.
 */
const setFloatRgbColor = (geometry: BufferGeometry): void => {
	const source = geometry.getAttribute('color')
	if (source !== undefined && source.itemSize === COLOR_ITEM_SIZE && !source.normalized) {
		return
	}

	const vertexCount = geometry.getAttribute('position').count
	const rgb = new Float32Array(vertexCount * COLOR_ITEM_SIZE)

	if (source === undefined) {
		rgb.fill(1)
	} else {
		// `getX`/`getY`/`getZ` undo the source's normalization, whatever it was.
		for (let vertex = 0; vertex < vertexCount; vertex += 1) {
			rgb[vertex * COLOR_ITEM_SIZE] = source.getX(vertex)
			rgb[vertex * COLOR_ITEM_SIZE + 1] = source.getY(vertex)
			rgb[vertex * COLOR_ITEM_SIZE + 2] = source.getZ(vertex)
		}
	}

	geometry.setAttribute('color', new BufferAttribute(rgb, COLOR_ITEM_SIZE))
}

/**
 * Rewrites `geometry` into the layout every geometry in a faces batch shares:
 * non-indexed, `position` + `normal` + `color`, nothing else.
 *
 * `BatchedMesh` rejects a geometry whose attribute set differs from the batch's
 * (`_validateGeometry`), and meshes arriving from RDK are indexed or not, with
 * or without `uv`, with or without color. Dropping the index is the cheap
 * direction to converge on: these meshes share few vertices, so `toNonIndexed`
 * costs a few percent more, and it removes the index buffer from the batch
 * entirely. Nothing reads `uv`, because `createSurfaceMaterial` never sets a
 * map.
 *
 * Returns a new geometry. The caller owns it, and should dispose it once
 * `addGeometry` has copied it into the batch.
 */
export const toFacesBatchLayout = (geometry: BufferGeometry): BufferGeometry => {
	const flattened = geometry.index === null ? geometry.clone() : geometry.toNonIndexed()

	for (const name of Object.keys(flattened.attributes)) {
		if (name !== 'position' && name !== 'normal' && name !== 'color') {
			flattened.deleteAttribute(name)
		}
	}

	// Flat normals, the geometry being non-indexed by this point. STL and the unit
	// primitives both ship normals, so this is the PLY fallback.
	if (flattened.getAttribute('normal') === undefined) {
		flattened.computeVertexNormals()
	}

	setFloatRgbColor(flattened)

	return flattened
}
