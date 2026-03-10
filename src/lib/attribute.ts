import { BufferGeometry, BufferAttribute } from 'three'
import { STRIDE } from './buffer'

const colorStride = (colors: Uint8Array, positions: Float32Array): number => {
	const numVertices = positions.length / STRIDE.POSITIONS
	const stride = colors.length / numVertices
	return stride === STRIDE.COLORS_RGBA ? STRIDE.COLORS_RGBA : STRIDE.COLORS_RGB
}

export const createBufferGeometry = (positions: Float32Array, colors?: Uint8Array | null) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (colors) {
<<<<<<< HEAD
		geometry.setAttribute(
			'color',
			new BufferAttribute(colors, getColorStride(positions, colors), true)
		)
=======
		const stride = colorStride(colors, positions)
		geometry.setAttribute('color', new BufferAttribute(colors, stride, true))
>>>>>>> 4ca57d31479791235f9554957a651327d65f6a87
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
<<<<<<< HEAD
			geometry.setAttribute(
				'color',
				new BufferAttribute(colors, getColorStride(positions, colors), true)
			)
=======
			const stride = colorStride(colors, positions)
			geometry.setAttribute('color', new BufferAttribute(colors, stride, true))
>>>>>>> 4ca57d31479791235f9554957a651327d65f6a87
		}
	}
}

const getColorStride = (positions: Float32Array, colors: Uint8Array) => {
	const numPositions = positions.length / 3
	const colorStride = colors.length / numPositions
	return colorStride
}
