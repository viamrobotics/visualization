import type { BatchedMesh, BufferGeometry } from 'three'

/**
 * Builds an uploader for a `BatchedMesh`, reclaiming or growing the shared
 * buffers whenever the next geometry will not fit.
 *
 * `addGeometry` allocates at the end of each buffer and throws
 * `'THREE.BatchedMesh: Reserved space request exceeds the maximum buffer size.'`
 * when it will not fit. `unusedVertexCount` and `unusedIndexCount` report
 * exactly those tails, so the check sits ahead of the call rather than wrapped
 * around it in a `try`.
 *
 * Pass `0` for `initialIndexCapacity` when the batch is non-indexed, as the
 * outlines batch is. Its geometries then report no indices either, so the index
 * budget stays at zero and never grows.
 *
 * This is a factory rather than a plain function because the capacities have to
 * be remembered between calls: `BatchedMesh` offers `setGeometrySize` but no
 * reader for the sizes it set.
 */
export const createBatchedGeometryAllocator = (
	mesh: BatchedMesh,
	initialVertexCapacity: number,
	initialIndexCapacity: number
) => {
	let vertexCapacity = initialVertexCapacity
	let indexCapacity = initialIndexCapacity

	return (geometry: BufferGeometry): number => {
		const requiredVertices = geometry.getAttribute('position').count
		const requiredIndices = geometry.getIndex()?.count ?? 0

		const fits = () =>
			mesh.unusedVertexCount >= requiredVertices && mesh.unusedIndexCount >= requiredIndices

		// A released geometry leaves a gap mid-buffer. Reclaiming those rewrites the
		// buffers once, where growing rewrites them and reallocates as well.
		if (!fits()) {
			mesh.optimize()
		}

		if (!fits()) {
			// Doubling keeps a run of small geometries amortized; the second term
			// covers a single one larger than everything allocated so far.
			const usedVertices = vertexCapacity - mesh.unusedVertexCount
			const usedIndices = indexCapacity - mesh.unusedIndexCount

			vertexCapacity = Math.max(vertexCapacity * 2, usedVertices + requiredVertices)
			indexCapacity = Math.max(indexCapacity * 2, usedIndices + requiredIndices)

			mesh.setGeometrySize(vertexCapacity, indexCapacity)
		}

		return mesh.addGeometry(geometry)
	}
}
