import { BufferGeometry, BufferAttribute } from 'three'

export const createBufferGeometry = (positions: Float32Array, colors?: Uint8Array | null) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (colors) {
		// Auto-detect RGB vs RGBA from position/color count ratio
		// RGB: positions.length / colors.length === 1.0 (3 position coords, 3 color channels)
		// RGBA: positions.length / colors.length === 0.75 (3 position coords, 4 color channels)
		const numPositions = positions.length / 3
		const colorStride = colors.length / numPositions
		geometry.setAttribute('color', new BufferAttribute(colors, colorStride, true))
	}

	return geometry
}

export const updateBufferGeometry = (
	geometry: BufferGeometry,
	positions: Float32Array,
	colors?: Uint8Array | null
) => {
	const positionAttr = geometry.getAttribute('position')

	if (positionAttr && positionAttr.array.length >= positions.length) {
		positionAttr.array.set(positions, 0)
		geometry.setDrawRange(0, positions.length)
		positionAttr.needsUpdate = true
	} else {
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
	}

	if (colors) {
		const colorAttr = geometry.getAttribute('color')

		if (colorAttr && colorAttr.array.length >= colors.length) {
			colorAttr.array.set(colors, 0)
			colorAttr.needsUpdate = true
		} else {
			// Auto-detect RGB vs RGBA from position/color count ratio
			const numPositions = positions.length / 3
			const colorStride = colors.length / numPositions
			geometry.setAttribute('color', new BufferAttribute(colors, colorStride, true))
		}
	}
}
