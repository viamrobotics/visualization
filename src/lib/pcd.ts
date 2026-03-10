export const createBinaryPCD = (positions: Float32Array, colors?: Uint8Array) => {
	const numPoints = positions.length / 3
	const hasColor = !!colors

	if (hasColor && colors!.length !== numPoints * 3) {
		throw new Error('Color array length must be numPoints * 3')
	}

	// 12 bytes xyz + optional 4 byte packed rgb
	const stride = hasColor ? 16 : 12

	const header = `# .PCD v0.7 - Point Cloud Data file format
VERSION 0.7
FIELDS x y z${hasColor ? ' rgb' : ''}
SIZE 4 4 4${hasColor ? ' 4' : ''}
TYPE F F F${hasColor ? ' F' : ''}
COUNT 1 1 1${hasColor ? ' 1' : ''}
WIDTH ${numPoints}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${numPoints}
DATA binary
`

	const headerBytes = new TextEncoder().encode(header)
	const bodyBuffer = new ArrayBuffer(numPoints * stride)
	const view = new DataView(bodyBuffer)

	for (let i = 0; i < numPoints; i++) {
		const offset = i * stride
		const pi = i * 3

		// XYZ
		view.setFloat32(offset + 0, positions[pi + 0], true)
		view.setFloat32(offset + 4, positions[pi + 1], true)
		view.setFloat32(offset + 8, positions[pi + 2], true)

		if (hasColor) {
			const r = colors![pi + 0]
			const g = colors![pi + 1]
			const b = colors![pi + 2]

			// pack into uint32
			const packed = (r << 16) | (g << 8) | b

			// write as float32
			view.setUint32(offset + 12, packed, true)
		}
	}

	return new Blob([headerBytes, bodyBuffer], {
		type: 'application/octet-stream',
	})
}
