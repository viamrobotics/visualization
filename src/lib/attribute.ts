import { BufferAttribute, BufferGeometry } from 'three'

import type { Metadata } from './metadata'

import { STRIDE } from './buffer'

export const createBufferGeometry = (positions: Float32Array, { colors, opacities }: Metadata) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (colors) {
		geometry.setAttribute('color', new BufferAttribute(colors, STRIDE.COLORS_RGB, true))
	}

	if (opacities) {
		geometry.setAttribute('opacity', new BufferAttribute(opacities, 1, true))
	}

	return geometry
}

export const updateBufferGeometry = (
	geometry: BufferGeometry,
	positions: Float32Array,
	{ colors, opacities }: Metadata
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
			geometry.setAttribute('color', new BufferAttribute(colors, STRIDE.COLORS_RGB, true))
		}
	}

	if (opacities) {
		const opacityAttr = geometry.getAttribute('opacity')
		if (opacityAttr && opacityAttr.array.length >= opacities.length) {
			opacityAttr.array.set(opacities, 0)
			opacityAttr.needsUpdate = true
		} else {
			geometry.setAttribute('opacity', new BufferAttribute(opacities, 1, true))
		}
	}
}
