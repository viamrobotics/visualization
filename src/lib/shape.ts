import { createPose } from './transform'
import type { Shape as ShapeProto } from '$lib/gen/draw/v1/drawing_pb'
import type { PlainMessage } from '@bufbuild/protobuf'

import type { Points, Line, Arrows, Model } from '$lib/gen/draw/v1/drawing_pb'
import type { Geometries } from './WorldObject.svelte'

export type Shape = PlainMessage<ShapeProto>

export type ArrowsGeometry = Shape & {
	geometryType: { case: 'arrows'; value: PlainMessage<Arrows> }
}

export type LineGeometry = Shape & {
	geometryType: { case: 'line'; value: PlainMessage<Line> }
}

export type PointsGeometry = Shape & {
	geometryType: { case: 'points'; value: PlainMessage<Points> }
}

export type ModelGeometry = Shape & {
	geometryType: { case: 'model'; value: PlainMessage<Model> }
}

export const isArrows = (shape?: Geometries): shape is ArrowsGeometry => {
	return shape !== undefined && shape.geometryType.case === 'arrows'
}

export const isLine = (shape?: Geometries): shape is LineGeometry => {
	return shape !== undefined && shape.geometryType.case === 'line'
}

export const isPoints = (shape?: Geometries): shape is PointsGeometry => {
	return shape !== undefined && shape.geometryType.case === 'points'
}

export const isModel = (shape?: Geometries): shape is ModelGeometry => {
	return shape !== undefined && shape.geometryType.case === 'model'
}

export const isShape = (shape?: Geometries): shape is Shape => {
	return isArrows(shape) || isLine(shape) || isPoints(shape) || isModel(shape)
}

export const createShape = <Type extends Shape['geometryType']>(geometryType: Type, label = '') => {
	return {
		center: createPose(),
		label,
		geometryType,
	}
}
