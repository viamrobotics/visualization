import type { BatchedMesh, Color, Vector4 } from 'three'

const meshesWithColors = new WeakSet<BatchedMesh>()

export const setBatchedColorAt = (
	mesh: BatchedMesh,
	instanceId: number,
	color: Color | Vector4
): void => {
	mesh.setColorAt(instanceId, color)

	if (meshesWithColors.has(mesh)) return

	meshesWithColors.add(mesh)
	mesh.material.needsUpdate = true
}
