import { BufferAttribute, BufferGeometry } from 'three'

import type { Metadata } from './metadata'

import { colorStride, STRIDE } from './buffer'

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

export const preAllocateBufferGeometry = (
	total: number,
	size: number,
	metadata: Metadata
): BufferGeometry => {
	const geometry = new BufferGeometry()

	const posAttr = new BufferAttribute(new Float32Array(total * size), size)
	geometry.setAttribute('position', posAttr)

	if (metadata.colors) {
		const stride = colorStride(metadata.colorFormat) || STRIDE.COLORS_RGB
		const colorAttr = new BufferAttribute(new Uint8Array(total * stride), stride, true)
		geometry.setAttribute('color', colorAttr)
	}

	if (metadata.opacities) {
		const opacityAttr = new BufferAttribute(new Uint8Array(total), 1, true)
		geometry.setAttribute('opacity', opacityAttr)
	}

	geometry.setDrawRange(0, 0)
	return geometry
}

export const writeBufferGeometryRange = (
	geometry: BufferGeometry,
	positions: Float32Array,
	start: number,
	metadata: Metadata
): void => {
	const chunkElements = positions.length / 3

	const posAttr = geometry.getAttribute('position') as BufferAttribute
	posAttr.array.set(positions, start * 3)
	posAttr.addUpdateRange(start * 3, chunkElements * 3)
	posAttr.needsUpdate = true

	if (metadata.colors) {
		const colorAttr = geometry.getAttribute('color') as BufferAttribute | null
		if (colorAttr) {
			const stride = colorAttr.itemSize
			;(colorAttr.array as Uint8Array).set(metadata.colors, start * stride)
			colorAttr.addUpdateRange(start * stride, chunkElements * stride)
			colorAttr.needsUpdate = true
		}
	}

	if (metadata.opacities) {
		const opacityAttr = geometry.getAttribute('opacity') as BufferAttribute | null
		if (opacityAttr) {
			;(opacityAttr.array as Uint8Array).set(metadata.opacities, start)
			opacityAttr.addUpdateRange(start, chunkElements)
			opacityAttr.needsUpdate = true
		}
	}

	const endPoint = start + chunkElements
	const currentEnd = geometry.drawRange.count
	if (endPoint > currentEnd) {
		geometry.setDrawRange(0, endPoint)
	}
}
