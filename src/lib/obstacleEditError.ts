import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { validateObstacleGeometries } from '$lib/obstacleGeometryValidation'

/** Which field an obstacle edit came from, so its error can sit beside it. */
export type ObstacleEditScope = 'label' | 'shape'

export interface ObstacleEditError {
	scope: ObstacleEditScope
	message: string
}

/**
 * Why rdk would reject `next`, an edit to the entry at `index`, or undefined when it would accept
 * it. The edited entry's own problem comes first. A shape problem elsewhere in the list names
 * that entry. A label problem does not, since rdk reports a repeated label at its other use.
 */
export const obstacleEditError = (
	next: ObstacleGeometryConfig[],
	index: number | undefined,
	scope: ObstacleEditScope
): ObstacleEditError | undefined => {
	const issues = validateObstacleGeometries(next)
	const issue = issues.find((candidate) => candidate.index === index) ?? issues[0]
	if (!issue) return undefined

	if (issue.index === undefined) return { scope: 'shape', message: issue.message }

	const namesOtherEntry = scope === 'shape' && issue.index !== index
	return {
		scope,
		message: namesOtherEntry ? `Geometry ${issue.index + 1}: ${issue.message}` : issue.message,
	}
}
