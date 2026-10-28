import type { BatchedMesh } from 'three'

export const setBatchedInstanceCount = (mesh: BatchedMesh, count: number): void => {
	mesh.setInstanceCount(count)
	mesh.material.needsUpdate = true
}
