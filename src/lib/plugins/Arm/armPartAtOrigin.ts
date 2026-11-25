import { commonApi, type robotApi } from '@viamrobotics/sdk'

/**
 * The frame system part of the arm called `name`, moved so its base sits at the world origin. The
 * rest of the frame system is dropped, which includes a gripper mounted on the arm: that is a part
 * of its own, parented to the arm rather than inside its kinematics.
 *
 * @returns A copy, so the cached reply is left untouched. `undefined` when no part has that name.
 */
export const armPartAtOrigin = (
	parts: readonly robotApi.FrameSystemConfig[],
	name: string
): robotApi.FrameSystemConfig | undefined => {
	const part = parts.find((candidate) => candidate.frame?.referenceFrame === name)
	if (!part?.frame) return undefined

	const atOrigin = part.clone()
	if (atOrigin.frame) {
		atOrigin.frame.poseInObserverFrame = new commonApi.PoseInFrame({
			referenceFrame: 'world',
			pose: new commonApi.Pose({ oZ: 1 }),
		})
	}
	return atOrigin
}
