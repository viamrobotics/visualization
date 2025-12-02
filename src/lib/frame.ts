// TODO: replace with types exported from the sdk when created

import type { Transform } from '@viamrobotics/sdk'
import type { ValueOf } from 'type-fest'

import { createPoseFromFrame } from './transform'
import { createGeometryFromFrame } from './geometry'

type FrameGeometryMap = {
	none: { type: 'none' }
	box: { type: 'box'; x: number; y: number; z: number }
	sphere: { type: 'sphere'; r: number }
	capsule: { type: 'capsule'; r: number; l: number }
}

export type FrameGeometry = keyof FrameGeometryMap
export type FrameGeometries = ValueOf<FrameGeometryMap>

type FrameOrientationMap = {
	quaternion: { type: 'quaternion'; value: { x: number; y: number; z: number; w: number } }
	euler_angles: { type: 'euler_angles'; value: { roll: number; pitch: number; yaw: number } }
	ov_degrees: { type: 'ov_degrees'; value: { x: number; y: number; z: number; th: number } }
	ov_radians: { type: 'ov_radians'; value: { x: number; y: number; z: number; th: number } }
}

export type FrameOrientation = keyof FrameOrientationMap
export type FrameOrientations = ValueOf<FrameOrientationMap>

export interface Frame<
	T extends FrameGeometry = FrameGeometry,
	K extends FrameOrientation = FrameOrientation,
> {
	id?: string
	name?: string
	parent: string
	translation: {
		x: number
		y: number
		z: number
	}
	orientation: FrameOrientationMap[K]
	geometry?: FrameGeometryMap[T]
}

export const createFrame = <
	T extends FrameGeometry = 'box',
	K extends FrameOrientation = 'ov_degrees',
>(
	geometry?: FrameGeometryMap[T]
): Frame<T> => {
	return {
		parent: 'world',
		translation: { x: 0, y: 0, z: 0 },
		orientation: {
			type: 'ov_degrees',
			value: { x: 0, y: 0, z: 1, th: 0 },
		} as FrameOrientationMap[K],
		geometry: (geometry ?? { type: 'box', x: 100, y: 100, z: 100 }) as FrameGeometryMap[T],
	} satisfies Frame<T>
}

export const createTransformFromFrame = (name: string, frame: Partial<Frame>): Transform => {
	return {
		uuid: new Uint8Array(),
		referenceFrame: name,
		poseInObserverFrame: {
			referenceFrame: frame.parent ?? 'world',
			pose: createPoseFromFrame(frame),
		},
		physicalObject: createGeometryFromFrame(frame),
	} satisfies Transform
}
