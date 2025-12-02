import { BufferDataType, parseBuffer } from './buffer-metadata'
import type { WorldObject } from './WorldObject.svelte'
import { RGBA_FIELDS, type RGBA } from './color'
import type { TypedArray } from 'three'
import type { ArrowsGeometry } from './shape'

export const ARROWS_POSE_FIELDS = ['x', 'y', 'z', 'ox', 'oy', 'oz']
export const ARROWS_POSE_SIZE = [4, 4, 4, 4, 4, 4]
export const ARROWS_POSE_TYPE = [
	BufferDataType.FLOAT,
	BufferDataType.FLOAT,
	BufferDataType.FLOAT,
	BufferDataType.FLOAT,
	BufferDataType.FLOAT,
	BufferDataType.FLOAT,
]

export const DEFAULT_ARROW_COLOR: RGBA = [0, 255, 0, 255] // Green in uint8 format

interface ParsedArrowsBuffer {
	poseData: TypedArray
	poses: number
	colorData: TypedArray
	colors: number
}

export const parseArrowsBuffer = (
	geometry: ArrowsGeometry,
	metadata: WorldObject['metadata']
): ParsedArrowsBuffer => {
	const { poses } = geometry.geometryType.value
	if (!poses.length) {
		console.warn('No poses found for arrows', {
			poses: poses,
		})

		return {
			poseData: new Float32Array(),
			poses: 0,
			colorData: new Float32Array(),
			colors: 0,
		}
	}

	const poseDataMm = parseBuffer(poses, {
		fields: ARROWS_POSE_FIELDS,
		size: ARROWS_POSE_SIZE,
		type: ARROWS_POSE_TYPE,
	})

	// Convert position components (x, y, z) from mm to m, keep orientation (ox, oy, oz) unchanged
	const poseData = new Float32Array(poseDataMm.length)
	const numPoses = poseDataMm.length / ARROWS_POSE_FIELDS.length
	for (let i = 0; i < numPoses; i++) {
		const idx = i * ARROWS_POSE_FIELDS.length
		// Scale position (x, y, z) from mm to m
		poseData[idx] = poseDataMm[idx] * 0.001
		poseData[idx + 1] = poseDataMm[idx + 1] * 0.001
		poseData[idx + 2] = poseDataMm[idx + 2] * 0.001
		// Keep orientation (ox, oy, oz) unchanged
		poseData[idx + 3] = poseDataMm[idx + 3]
		poseData[idx + 4] = poseDataMm[idx + 4]
		poseData[idx + 5] = poseDataMm[idx + 5]
	}

	const colorData = metadata?.colors ?? new Float32Array([0, 1, 0, 1])

	return {
		poseData,
		colorData,
		poses: numPoses,
		colors: colorData.length / RGBA_FIELDS.length,
	}
}
