import type { traits } from '#lib/ecs/index.js'
import type { UnhealthyResource } from '#lib/hooks/resources/unhealthyResources.js'

import { poseStalenessSummary } from './poseStalenessSummary'

/**
 * Why the scene stopped updating, as issue lines: the summary, then each unhealthy
 * resource as the likely cause. With none to blame, the second line says what the
 * scene is showing instead.
 */
export const stalenessLines = (unhealthy: UnhealthyResource[]): traits.IssueLine[] => {
	const summary: traits.IssueLine = { severity: 'warn', message: poseStalenessSummary(unhealthy) }

	if (unhealthy.length === 0) {
		return [
			summary,
			{
				severity: 'warn',
				message:
					'The machine stopped answering pose requests. The scene is showing the last poses returned.',
			},
		]
	}

	return [
		summary,
		...unhealthy.map(({ name, error }) => ({
			severity: 'warn' as const,
			message: error ? `${name}: ${error}` : name,
		})),
	]
}
