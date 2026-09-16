import type { robotApi } from '@viamrobotics/sdk'

/**
 * Frames the machine can answer a `getPose` for: the ones its frame system
 * reports, plus the links derived from a component's kinematics model.
 *
 * A frame in the scene but outside this set reached it through the part config
 * alone, so the machine has never built it and cannot resolve it.
 */
export const machineFrameNames = (
	parts: robotApi.FrameSystemConfig[] = [],
	derivedFrameNames: Iterable<string> = []
): Set<string> => {
	const names = new Set<string>()

	for (const { frame } of parts) {
		if (frame !== undefined && frame.referenceFrame !== '') {
			names.add(frame.referenceFrame)
		}
	}

	for (const name of derivedFrameNames) {
		names.add(name)
	}

	return names
}
