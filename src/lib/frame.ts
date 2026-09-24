// TODO: replace with types exported from the sdk when created

import type { Transform } from '@viamrobotics/sdk'

import { UuidTool } from 'uuid-tool'

import { createGeometryFromFrame } from '$lib/geometry'
import { Pose } from '$lib/math'

type FrameGeometryMap = {
	none: { type: 'none' }
	box: { type: 'box'; x: number; y: number; z: number }
	sphere: { type: 'sphere'; r: number }
	capsule: { type: 'capsule'; r: number; l: number }
}

export type FrameGeometry = keyof FrameGeometryMap

type FrameOrientationMap = {
	quaternion: { type: 'quaternion'; value: { x: number; y: number; z: number; w: number } }
	euler_angles: { type: 'euler_angles'; value: { roll: number; pitch: number; yaw: number } }
	ov_degrees: { type: 'ov_degrees'; value: { x: number; y: number; z: number; th: number } }
	ov_radians: { type: 'ov_radians'; value: { x: number; y: number; z: number; th: number } }
	/** rdk's `R4AA`: an axis plus a rotation about it, in radians. */
	axis_angles: { type: 'axis_angles'; value: { x: number; y: number; z: number; th: number } }
}

export type FrameOrientation = keyof FrameOrientationMap

export type FrameEulerDegrees = FrameOrientationMap['euler_angles']['value']

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

/**
 * A frame at its parent's origin with no geometry, matching what app.viam.com
 * writes when a frameless component gets a frame. The user picks a shape after,
 * so guessing one here would put a body in the scene they never asked for.
 */
export const createFrame = (): Frame => {
	return {
		parent: 'world',
		translation: { x: 0, y: 0, z: 0 },
		orientation: {
			type: 'ov_degrees',
			value: { x: 0, y: 0, z: 1, th: 0 },
		},
	} satisfies Frame
}

export const createTransformFromFrame = (name: string, frame: Partial<Frame>): Transform => {
	return {
		uuid: new Uint8Array(UuidTool.toBytes(UuidTool.newUuid())),
		referenceFrame: name,
		poseInObserverFrame: {
			referenceFrame: frame.parent ?? 'world',
			pose: new Pose().setFromFrame(frame),
		},
		physicalObject: createGeometryFromFrame(frame),
	} satisfies Transform
}
