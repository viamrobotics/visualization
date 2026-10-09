import type { Transform } from '$lib/geometry'

import { ownerOfInternalFrame } from '$lib/kinematicsFrames'

/**
 * The derived frames to draw while the part config is authoritative: every
 * component in `obstacleFramesByComponent` swaps the links the machine reported
 * for it for the ones its config declares. An empty list still claims the
 * component, so all of its machine links are dropped. Inputs are not mutated.
 */
export const mergeObstacleFrames = (
	kinematicsFrames: Record<string, Transform>,
	obstacleFramesByComponent: Record<string, Transform[]>
): Record<string, Transform> => {
	const merged: Record<string, Transform> = {}

	for (const [name, frame] of Object.entries(kinematicsFrames)) {
		const owner = ownerOfInternalFrame(name)
		if (owner !== undefined && owner in obstacleFramesByComponent) {
			continue
		}
		merged[name] = frame
	}

	for (const obstacleFrames of Object.values(obstacleFramesByComponent)) {
		for (const frame of obstacleFrames) {
			merged[frame.referenceFrame] = frame
		}
	}

	return merged
}
