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
		geometry.setAttribute('opacity', new BufferAttribute(opacities, STRIDE.OPACITIES, true))
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
			geometry.setAttribute('opacity', new BufferAttribute(opacities, STRIDE.OPACITIES, true))
		}
	}
}

/**
 * Pre-allocates a BufferGeometry for `total` elements with drawRange starting at 0.
 *
 * @param total - The total number of elements across all chunks.
 * @param size - The number of components per element (e.g. 3 for xyz).
 * @param metadata - The metadata for the geometry.
 * @returns A BufferGeometry with the given total and metadata.
 */
export const preAllocateBufferGeometry = (
	total: number,
	size: number,
	{ colors, opacities }: Metadata
): BufferGeometry => {
	const geometry = new BufferGeometry()

	const posAttr = new BufferAttribute(new Float32Array(total * size), size)
	geometry.setAttribute('position', posAttr)

	if (colors) {
		const colorAttr = new BufferAttribute(
			new Uint8Array(total * STRIDE.COLORS_RGB),
			STRIDE.COLORS_RGB,
			true
		)
		geometry.setAttribute('color', colorAttr)
	}

	if (opacities) {
		const opacityAttr = new BufferAttribute(new Uint8Array(total), STRIDE.OPACITIES, true)
		geometry.setAttribute('opacity', opacityAttr)
	}

	geometry.setDrawRange(0, 0)
	return geometry
}

/**
 * Writes a chunk of positions/colors/opacities into a pre-allocated BufferGeometry
 * at the given element offset, then advances drawRange to reveal new points.
 */
export const writeBufferGeometryRange = (
	geometry: BufferGeometry,
	positions: Float32Array,
	start: number,
	{ colors, opacities }: Metadata
): void => {
	const chunkElements = positions.length / 3

	const posAttr = geometry.getAttribute('position') as BufferAttribute
	posAttr.array.set(positions, start * 3)
	posAttr.addUpdateRange(start * 3, chunkElements * 3)
	posAttr.needsUpdate = true

	if (colors) {
		const colorAttr = geometry.getAttribute('color') as BufferAttribute | null
		if (colorAttr) {
			;(colorAttr.array as Uint8Array).set(colors, start * STRIDE.COLORS_RGB)
			colorAttr.addUpdateRange(start * STRIDE.COLORS_RGB, chunkElements * STRIDE.COLORS_RGB)
			colorAttr.needsUpdate = true
		}
	}

	if (opacities) {
		const opacityAttr = geometry.getAttribute('opacity') as BufferAttribute | null
		if (opacityAttr) {
			;(opacityAttr.array as Uint8Array).set(opacities, start)
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
