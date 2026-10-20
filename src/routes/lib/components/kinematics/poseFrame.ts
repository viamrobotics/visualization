import type { PlainMessage } from '@bufbuild/protobuf'

import type { Pose as PoseProto } from '$lib/buf/common/v1/common_pb'
import type { Frame } from '$lib/frame'

import { Pose } from '$lib/math'

export type PoseFrame = Pick<Frame, 'translation' | 'orientation'>

type PoseMessage = PlainMessage<PoseProto>

/** The rdk frame shape `PoseFields` edits, for a proto pose. An absent pose reads as the origin. */
export const poseToFrame = (pose: PoseMessage | undefined): PoseFrame => ({
	translation: { x: pose?.x ?? 0, y: pose?.y ?? 0, z: pose?.z ?? 0 },
	orientation: {
		type: 'ov_degrees',
		value: { x: pose?.oX ?? 0, y: pose?.oY ?? 0, z: pose?.oZ ?? 1, th: pose?.theta ?? 0 },
	},
})

/** The proto pose for a frame shape in any rdk orientation type. Orientation comes back as an OV in degrees. */
export const frameToPose = (frame: PoseFrame): PoseMessage => {
	const pose = new Pose().setFromFrame(frame)
	return {
		x: pose.x,
		y: pose.y,
		z: pose.z,
		oX: pose.oX,
		oY: pose.oY,
		oZ: pose.oZ,
		theta: pose.theta,
	}
}
