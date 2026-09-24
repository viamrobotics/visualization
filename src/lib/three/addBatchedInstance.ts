import type { BatchedMesh } from 'three'

/**
 * Allocates an instance slot, doubling the batch's capacity when it is full.
 *
 * `BatchedMesh.addInstance` throws `'THREE.BatchedMesh: Maximum item count
 * reached.'` once every slot is live, so a caller that streams entities in has
 * to grow the batch itself. Growth reallocates and copies the matrices, colors,
 * and indirect textures, so it doubles rather than growing by one.
 */
export const addBatchedInstance = (mesh: BatchedMesh, geometryId: number): number => {
	// `instanceCount` counts live slots, not the high-water mark, so it reaches
	// `maxInstanceCount` exactly when the free list is empty and `addInstance` throws.
	if (mesh.instanceCount >= mesh.maxInstanceCount) {
		mesh.setInstanceCount(mesh.maxInstanceCount * 2)
	}

	return mesh.addInstance(geometryId)
}
