import type { BatchedMesh, BufferGeometry } from 'three'

/**
 * Builds an uploader for a non-indexed `BatchedMesh`, reclaiming or growing the
 * shared vertex buffer whenever the tail is too short for the next geometry.
 *
 * `BatchedMesh.addGeometry` allocates at the end of the buffer and throws
 * `'THREE.BatchedMesh: Reserved space request exceeds the maximum buffer size.'`
 * when it will not fit. `unusedVertexCount` reports exactly that tail, so the
 * check sits ahead of the call rather than wrapped around it.
 *
 * This is a factory rather than a plain function because the capacity has to be
 * remembered between calls: `BatchedMesh` offers `setGeometrySize` but no reader
 * for the size it set.
 */
export const createBatchedGeometryAllocator = (
	mesh: BatchedMesh,
	initialVertexCapacity: number
) => {
	let vertexCapacity = initialVertexCapacity

	return (geometry: BufferGeometry): number => {
		const required = geometry.getAttribute('position').count

		// A released geometry leaves a gap mid-buffer. Reclaiming those rewrites the
		// buffer once, where growing rewrites it and reallocates as well.
		if (mesh.unusedVertexCount < required) {
			mesh.optimize()
		}

		if (mesh.unusedVertexCount < required) {
			// Doubling keeps a run of small meshes amortized; the second term covers
			// a single mesh larger than everything allocated so far.
			const used = vertexCapacity - mesh.unusedVertexCount
			vertexCapacity = Math.max(vertexCapacity * 2, used + required)
			mesh.setGeometrySize(vertexCapacity, 0)
		}

		return mesh.addGeometry(geometry)
	}
}
