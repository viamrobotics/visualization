import type { robotApi } from '@viamrobotics/sdk'

import type { RawKinematicsModel } from '$lib/kinematicsTransform'

/**
 * The kinematics model of every component in a `frameSystemConfig` reply, keyed by component name.
 * A component without a model, or with an empty one, is left out.
 */
export const kinematicsByComponent = (
	parts: readonly robotApi.FrameSystemConfig[]
): Record<string, RawKinematicsModel> => {
	const result: Record<string, RawKinematicsModel> = {}
	for (const fsConfig of parts) {
		const componentName = fsConfig.frame?.referenceFrame
		if (
			componentName === undefined ||
			componentName === '' ||
			fsConfig.kinematics === undefined ||
			Object.keys(fsConfig.kinematics.fields).length === 0
		) {
			continue
		}
		result[componentName] = fsConfig.kinematics.toJson() as RawKinematicsModel
	}
	return result
}
