import { Box3, BufferAttribute, BufferGeometry, Sphere, type Vector3Like } from 'three'

import type { Metadata } from './metadata'

import { colorStride, STRIDE } from './buffer'

/** Extent of a set of positions, in the form three.js caches on a `BufferGeometry`. */
export interface Bounds {
	min: Vector3Like
	max: Vector3Like
	center: Vector3Like
	radius: number
}

/**
 * Callers that already know the extent hand it over here. Without it the cached values must be
 * dropped instead, and three.js walks every position again on the next render.
 */
const applyBounds = (geometry: BufferGeometry, bounds: Bounds | undefined) => {
	if (!bounds) {
		geometry.boundingBox = null
		geometry.boundingSphere = null
		return
	}

	geometry.boundingBox ??= new Box3()
	geometry.boundingBox.min.copy(bounds.min)
	geometry.boundingBox.max.copy(bounds.max)

	geometry.boundingSphere ??= new Sphere()
	geometry.boundingSphere.center.copy(bounds.center)
	geometry.boundingSphere.radius = bounds.radius
}

export const createBufferGeometry = (
	positions: Float32Array,
	metadata?: Metadata,
	bounds?: Bounds
) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (metadata?.colors) {
		const stride = colorStride(metadata.colorFormat)
		geometry.setAttribute('color', new BufferAttribute(metadata.colors, stride, true))
	}

	if (metadata?.opacities) {
		geometry.setAttribute('opacity', new BufferAttribute(metadata.opacities, 1, true))
	}

	if (bounds) applyBounds(geometry, bounds)

	return geometry
}

/**
 * Uploads only what was just written. A reused attribute can be far larger than the incoming
 * data, and three.js re-sends the whole buffer for an attribute carrying no ranges. Replacing
 * rather than appending keeps ranges from piling up across updates that never got rendered.
 */
const setUpdateRange = (attribute: BufferAttribute, length: number) => {
	attribute.clearUpdateRanges()
	attribute.addUpdateRange(0, length)
	attribute.needsUpdate = true
}

/**
 * Rewrite the color and opacity attributes in place, reallocating only when the
 * incoming data outgrows the existing capacity. Leaves positions and the draw
 * range untouched, so it is safe to call on a partially-filled chunked cloud.
 */
export const updateBufferGeometryColors = (geometry: BufferGeometry, metadata: Metadata) => {
	if (metadata.colors) {
		const stride = colorStride(metadata.colorFormat)
		const colorAttr = geometry.getAttribute('color') as BufferAttribute | null
		if (colorAttr && colorAttr.array.length >= metadata.colors.length) {
			colorAttr.array.set(metadata.colors, 0)
			setUpdateRange(colorAttr, metadata.colors.length)
		} else {
			geometry.setAttribute('color', new BufferAttribute(metadata.colors, stride, true))
		}
	}

	if (metadata.opacities) {
		const opacityAttr = geometry.getAttribute('opacity') as BufferAttribute | null
		if (opacityAttr && opacityAttr.array.length >= metadata.opacities.length) {
			opacityAttr.array.set(metadata.opacities, 0)
			setUpdateRange(opacityAttr, metadata.opacities.length)
		} else {
			geometry.setAttribute('opacity', new BufferAttribute(metadata.opacities, 1, true))
		}
	}
}

export const updateBufferGeometry = (
	geometry: BufferGeometry,
	positions: Float32Array,
	metadata: Metadata,
	bounds?: Bounds
) => {
	const positionAttr = geometry.getAttribute('position') as BufferAttribute | null

	if (positionAttr && positionAttr.array.length >= positions.length) {
		positionAttr.array.set(positions, 0)
		// `count` is in vertices, not array elements. Passing the element count
		// leaves the tail of a shrinking cloud renderable: three.js clamps the
		// range to the attribute's capacity, which a 3× count exceeds.
		geometry.setDrawRange(0, positions.length / positionAttr.itemSize)
		setUpdateRange(positionAttr, positions.length)
	} else {
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		// A fresh attribute defines the whole range. A leftover count from the previous,
		// shorter cloud would truncate it.
		geometry.setDrawRange(0, Infinity)
	}

	// Neither writing through an attribute nor replacing one invalidates the
	// cached sphere, so a cloud whose extent changed would keep being frustum
	// culled against wherever its first version sat.
	applyBounds(geometry, bounds)

	updateBufferGeometryColors(geometry, metadata)
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

	// Each chunk can extend the cloud past the sphere computed from the last one.
	geometry.boundingSphere = null
}
