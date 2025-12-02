import { BufferDataType, parseBuffer } from './buffer-metadata'
import type { WorldObject } from './WorldObject.svelte'
import type { Drawing } from './gen/draw/v1/drawing_pb'
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

export const DEFAULT_ARROW_COLOR: RGBA = [0, 1, 0, 1]

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

	const poseData = parseBuffer(poses, {
		fields: ARROWS_POSE_FIELDS,
		size: ARROWS_POSE_SIZE,
		type: ARROWS_POSE_TYPE,
	})

	const colorData = metadata?.colors ?? new Float32Array([0, 1, 0, 1])

	return {
		poseData,
		colorData,
		poses: poseData.length / ARROWS_POSE_FIELDS.length,
		colors: colorData.length / RGBA_FIELDS.length,
	}
}
