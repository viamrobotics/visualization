import type { PlainMessage } from '@bufbuild/protobuf'

import { Matrix4 } from 'three'

import type { Pose } from '$lib/buf/common/v1/common_pb'

import { Pose as PoseMath } from '$lib/math/pose'

type PoseMessage = PlainMessage<Pose>

export const IDENTITY_POSE: Readonly<PoseMessage> = {
	x: 0,
	y: 0,
	z: 0,
	oX: 0,
	oY: 0,
	oZ: 1,
	theta: 0,
}

/** The matrix, in metres, of a spec pose in millimetres and OV degrees. An absent pose is identity. */
export const poseToMatrix = (pose: PoseMessage | undefined): Matrix4 =>
	pose ? new PoseMath().copy(pose).toMatrix4() : new Matrix4()

/** The spec pose, in millimetres and OV degrees, of a matrix in metres. */
export const matrixToPose = (matrix: Matrix4): PoseMessage => {
	const { x, y, z, oX, oY, oZ, theta } = new PoseMath().setFromMatrix4(matrix)
	return { x, y, z, oX, oY, oZ, theta }
}
