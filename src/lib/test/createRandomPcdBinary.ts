export const createRandomPcdBinary = (numPoints = 200, scale = 1, axes = 'xyz'): Uint8Array => {
	const header = `
# .PCD v0.7 - Point Cloud Data file format
VERSION 0.7
FIELDS x y z rgb
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1
WIDTH ${numPoints}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${numPoints}
DATA ascii
`.trim()

	const doX = axes.includes('x')
	const doY = axes.includes('y')
	const doZ = axes.includes('z')

	const points = Array.from({ length: numPoints }, () => {
		const x = doX ? ((Math.random() - 0.5) * scale).toFixed(6) : '0.000000'
		const y = doY ? ((Math.random() - 0.5) * scale).toFixed(6) : '0.000000'
		const z = doZ ? ((Math.random() - 0.5) * scale).toFixed(6) : '0.000000'

		const red = Math.floor(Math.random() * 256)
		const green = Math.floor(Math.random() * 256)
		const blue = Math.floor(Math.random() * 256)

		const rgbInt = (red << 16) | (green << 8) | blue
		const rgbFloat = String(new Float32Array(new Uint32Array([rgbInt]).buffer)[0])

		return `${x} ${y} ${z} ${rgbFloat}`
	})

	const encoder = new TextEncoder()
	return encoder.encode(`${header}\n${points.join('\n')}`)
}
