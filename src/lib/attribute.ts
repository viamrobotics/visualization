import { BufferAttribute, BufferGeometry } from 'three'

import { STRIDE } from './buffer'
import type { LODLevel } from './loaders/pcd/messages'

const colorStride = (colors: Uint8Array, positions: Float32Array): number => {
	const numVertices = positions.length / STRIDE.POSITIONS
	const stride = colors.length / numVertices
	return stride === STRIDE.COLORS_RGBA ? STRIDE.COLORS_RGBA : STRIDE.COLORS_RGB
}

export const createBufferGeometry = (positions: Float32Array, colors?: Uint8Array | null) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))

	if (colors) {
		const stride = colorStride(colors, positions)
		geometry.setAttribute('color', new BufferAttribute(colors, stride, true))
	}

	return geometry
}

export interface LODGeometryLevel {
	geometry: BufferGeometry
	distance: number
}

export const createLODGeometries = (levels: LODLevel[]): LODGeometryLevel[] => {
	return levels.map((level) => ({
		geometry: createBufferGeometry(level.positions, level.colors),
		distance: level.distance,
	}))
}

export const updateLODGeometries = (
	existing: LODGeometryLevel[],
	levels: LODLevel[]
): LODGeometryLevel[] => {
	if (existing.length !== levels.length) {
		for (const { geometry } of existing) {
			geometry.dispose()
		}
		return createLODGeometries(levels)
	}

	for (let i = 0; i < levels.length; i++) {
		updateBufferGeometry(existing[i]!.geometry, levels[i]!.positions, levels[i]!.colors)
		existing[i]!.distance = levels[i]!.distance
	}

	return existing
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
			const stride = colorStride(colors, positions)
			geometry.setAttribute('color', new BufferAttribute(colors, stride, true))
		}
	}
}
