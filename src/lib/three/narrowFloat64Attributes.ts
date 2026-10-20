import { BufferAttribute, type BufferGeometry } from 'three'

/**
 * Rewrites every `Float64Array` attribute on `geometry` as `Float32Array`, in place.
 *
 * WebGL has no 64-bit vertex attribute type, so uploading one throws out of
 * `WebGLAttributes.createBuffer` partway through a render and stops the whole loop, not
 * just the object carrying it. A PLY declares its own precision per property, and RDK
 * passes a file-loaded mesh through byte for byte, so a mesh Open3D wrote arrives as
 * `property double`.
 */
export const narrowFloat64Attributes = (geometry: BufferGeometry): BufferGeometry => {
	for (const [name, attribute] of Object.entries(geometry.attributes)) {
		// An interleaved attribute shares its buffer with its neighbours, so it cannot be
		// replaced one attribute at a time. No loader here produces a 64-bit one.
		if (!(attribute instanceof BufferAttribute)) continue

		if (!(attribute.array instanceof Float64Array)) continue

		geometry.setAttribute(
			name,
			new BufferAttribute(
				new Float32Array(attribute.array),
				attribute.itemSize,
				attribute.normalized
			)
		)
	}

	return geometry
}
