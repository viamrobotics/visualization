import type { WorldObject } from './WorldObject.svelte'
import type { Drawing } from './gen/draw/v1/drawing_pb'
import { RGBA_FIELDS, type RGBA } from './color'
import type { TypedArray, Vector3 } from 'three'
import { parsePoints } from './point'

export const DEFAULT_LINE_WIDTH = 0.005
export const DEFAULT_LINE_DOT_SIZE = 0.01

export const DEFAULT_LINE_COLOR: RGBA = [0, 128, 255, 255] // blue
export const DEFAULT_LINE_POINT_COLOR: RGBA = [0, 77, 204, 255] // darker blue

interface ParsedLineBuffer {
	pointsData: TypedArray
	points: Vector3[]
	colorData: TypedArray
	hasDotColor: boolean
}

export const parseLineBuffer = (
	drawing: Drawing,
	metadata: WorldObject['metadata']
): ParsedLineBuffer => {
	const line =
		drawing.physicalObject?.geometryType?.case === 'line'
			? drawing.physicalObject.geometryType.value
			: null

	if (!line?.positions.length) {
		console.warn('No points found for line', {
			points: line?.positions.length,
		})

		return {
			pointsData: new Float32Array(),
			points: [],
			colorData: new Float32Array(),
			hasDotColor: false,
		}
	}

	const { pointsData, points } = parsePoints(line.positions)

	// metadata.colors should already be a Float32Array parsed in WorldObject constructor (RGBA format)
	// Default to both line and point colors if no colors provided
	let colorData =
		metadata?.colors ?? new Float32Array([...DEFAULT_LINE_COLOR, ...DEFAULT_LINE_POINT_COLOR])

	// Check if we have dual colors (line + dots) - now RGBA format
	let hasDotColor = false
	if (colorData.length === RGBA_FIELDS.length * 2) {
		hasDotColor = true
	}

	return {
		pointsData,
		points,
		colorData,
		hasDotColor,
	}
}
