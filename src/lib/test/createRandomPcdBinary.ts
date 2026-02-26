import { createBinaryPCD } from '$lib/pcd'

export const createRandomPcdBinary = async (
	numPoints = 200,
	scale = 1,
	axes = 'xyz'
): Promise<Uint8Array> => {
	const doX = axes.includes('x')
	const doY = axes.includes('y')
	const doZ = axes.includes('z')

	const positions = new Float32Array(numPoints * 3)
	const colors = new Uint8Array(numPoints * 3)

	for (let i = 0, l = positions.length; i < l; i += 1) {
		positions[i] = doX ? (Math.random() - 0.5) * scale : 0
		positions[i + 1] = doY ? (Math.random() - 0.5) * scale : 0
		positions[i + 2] = doZ ? (Math.random() - 0.5) * scale : 0

		colors[i] = Math.floor(Math.random() * 256)
		colors[i + 1] = Math.floor(Math.random() * 256)
		colors[i + 2] = Math.floor(Math.random() * 256)
	}

	const buffer = await createBinaryPCD(positions, colors).arrayBuffer()
	return new Uint8Array(buffer)
}
