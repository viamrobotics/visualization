import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { validateObstacleGeometries } from '$lib/obstacleGeometryValidation'

/** Which field an obstacle edit came from, so its error can sit beside it. */
export type ObstacleEditScope = 'label' | 'shape'

export interface ObstacleEditError {
	scope: ObstacleEditScope
	message: string
}

/**
 * Why rdk would reject `next`, an edit of `previous` to the entry at `index`, or undefined when
 * the edit adds no problem. An entry that was already broken never blocks, so stored problems
 * can be fixed one field at a time. The edited entry's own problem comes first. A shape problem
 * elsewhere in the list names that entry. A label problem does not, since rdk reports a repeated
 * label at its other use.
 */
export const obstacleEditError = (
	previous: ObstacleGeometryConfig[],
	next: ObstacleGeometryConfig[],
	index: number | undefined,
	scope: ObstacleEditScope
): ObstacleEditError | undefined => {
	const brokenBefore = new Set(
		validateObstacleGeometries(previous).flatMap((issue) =>
			issue.index === undefined ? [] : [previous[issue.index]]
		)
	)
	// Untouched entries keep their object through an edit. The edited one is compared with its old self.
	const wasBroken = (entryIndex: number) =>
		brokenBefore.has(next[entryIndex]) ||
		(entryIndex === index && brokenBefore.has(previous[entryIndex]))

	const issues = validateObstacleGeometries(next).filter(
		(issue) => issue.index === undefined || !wasBroken(issue.index)
	)
	const issue = issues.find((candidate) => candidate.index === index) ?? issues[0]
	if (!issue) return undefined

	if (issue.index === undefined) return { scope: 'shape', message: issue.message }

	const namesOtherEntry = scope === 'shape' && issue.index !== index
	return {
		scope,
		message: namesOtherEntry ? `Geometry ${issue.index + 1}: ${issue.message}` : issue.message,
	}
}
