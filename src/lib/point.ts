import { Vector3 } from 'three'
import { BufferDataType, parseBuffer } from './buffer-metadata'
import type { RGBA } from './color'

export const POINT_FIELDS = ['x', 'y', 'z']
export const POINT_SIZE = [4, 4, 4]
export const POINT_TYPE = [BufferDataType.FLOAT, BufferDataType.FLOAT, BufferDataType.FLOAT]

export const DEFAULT_POINT_COLOR: RGBA = [0.2, 0.2, 0.2, 1] // #333333
export const DEFAULT_POINT_SIZE = 0.01

export const parsePoints = (data: Uint8Array) => {
	const pointsDataMm = parseBuffer(data, {
		fields: POINT_FIELDS,
		size: POINT_SIZE,
		type: POINT_TYPE,
	})

	// Convert from millimeters to meters for Three.js
	const pointsData = new Float32Array(pointsDataMm.length)
	for (let i = 0; i < pointsDataMm.length; i++) {
		pointsData[i] = pointsDataMm[i] * 0.001
	}

	const points: Vector3[] = []
	const numPoints = pointsData.length / POINT_FIELDS.length
	for (let i = 0; i < numPoints; i++) {
		const idx = i * POINT_FIELDS.length
		points.push(new Vector3(pointsData[idx], pointsData[idx + 1], pointsData[idx + 2]))
	}

	return {
		pointsData,
		points,
	}
}
