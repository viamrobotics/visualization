import type { UnhealthyResource } from './unhealthyResources'

/**
 * One-line explanation of why the scene stopped updating. Names the offending
 * resource when exactly one is unhealthy; past that the summary stays a count
 * and the indicator's tooltip lists them.
 */
export const poseStalenessSummary = (unhealthy: UnhealthyResource[]): string => {
	const [first] = unhealthy

	if (!first) {
		return 'Poses are not updating'
	}

	return unhealthy.length === 1
		? `Poses are not updating: ${first.name} is unhealthy`
		: `Poses are not updating: ${unhealthy.length} resources are unhealthy`
}
