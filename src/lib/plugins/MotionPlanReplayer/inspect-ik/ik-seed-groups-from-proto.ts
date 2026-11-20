import type {
	GetIKSolutionsResponse,
	JointPositions,
} from '#lib/buf/motionplan/v1/motionplan_pb.js'

import type { IKSeedGroup } from './parse-ik-solutions'

/**
 * Proto3 maps are never null and arrive as `{}` when the solver produced nothing, but the plugin
 * distinguishes "nothing to draw" by `configuration === null`. The emptiness has to be re-encoded.
 */
const unwrapJointPositions = (
	positions: Record<string, JointPositions>
): Record<string, number[]> | null => {
	const entries = Object.entries(positions)
	if (entries.length === 0) return null
	return Object.fromEntries(
		entries.map(([frame, jointPositions]) => [frame, jointPositions.values])
	)
}

/**
 * Maps a `GetIKSolutions` response to the replayer's seed groups, the same shape
 * `parseIKSolutions` produces from JSON.
 */
export const ikSeedGroupsFromProto = (response: GetIKSolutionsResponse): IKSeedGroup[] =>
	response.results.map((result) => ({
		seed: result.seed,
		solutions: result.solutions.map((solution) => ({
			cost: solution.cost,
			configuration: unwrapJointPositions(solution.configuration),
			configurationValid: solution.configurationValid,
			// Absent means the path check never ran, which only happens when the configuration was
			// already rejected — the same outcome as an explicit false.
			checkpathValid: solution.checkpathValid ?? false,
			error: solution.configurationError,
			firstError: solution.firstError,
			lastGoodInputs: unwrapJointPositions(solution.lastGoodInputs) ?? undefined,
		})),
	}))
