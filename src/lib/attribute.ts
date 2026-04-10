import { BufferAttribute, BufferGeometry } from 'three'

import type { Metadata } from './metadata'

import { colorStride } from './buffer'

export const createBufferGeometry = (positions: Float32Array, metadata?: Metadata) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (metadata?.colors) {
		const stride = colorStride(metadata.colorFormat)
		geometry.setAttribute('color', new BufferAttribute(metadata.colors, stride, true))
	}

	if (metadata?.opacities) {
		geometry.setAttribute('opacity', new BufferAttribute(metadata.opacities, 1, true))
	}

	return geometry
}

export const updateBufferGeometry = (
	geometry: BufferGeometry,
	positions: Float32Array,
	metadata: Metadata
) => {
	const positionAttr = geometry.getAttribute('position')

	if (positionAttr && positionAttr.array.length >= positions.length) {
		positionAttr.array.set(positions, 0)
		geometry.setDrawRange(0, positions.length)
		positionAttr.needsUpdate = true
	} else {
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
	}

	if (metadata.colors) {
		const stride = colorStride(metadata.colorFormat)
		const colorAttr = geometry.getAttribute('color')
		if (colorAttr && colorAttr.array.length >= metadata.colors.length) {
			colorAttr.array.set(metadata.colors, 0)
			colorAttr.needsUpdate = true
		} else {
			geometry.setAttribute('color', new BufferAttribute(metadata.colors, stride, true))
		}
	}

	if (metadata.opacities) {
		const opacityAttr = geometry.getAttribute('opacity')
		if (opacityAttr && opacityAttr.array.length >= metadata.opacities.length) {
			opacityAttr.array.set(metadata.opacities, 0)
			opacityAttr.needsUpdate = true
		} else {
			geometry.setAttribute('opacity', new BufferAttribute(metadata.opacities, 1, true))
		}
	}
}
