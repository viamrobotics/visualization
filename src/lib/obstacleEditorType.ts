import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { boundsHintFromWalls, boundsWallsMatch, parseBoundsHint } from '$lib/boundsHint'
import { Pose } from '$lib/math'
import {
	type ObstacleEditorHint,
	obstacleGeometriesOf,
	type ObstacleGeometryConfig,
} from '$lib/obstacleAttributes'

const IDENTITY = new Pose()

const hasOffset = ({ translation, orientation }: ObstacleGeometryConfig): boolean =>
	!new Pose().setFromFrame({ translation, orientation }).equals(IDENTITY)

/**
 * The type an obstacle's geometries read as without a hint: Bounds when they are walls one hint
 * generates, Simple when they are one shape at the obstacle's origin, and Complex otherwise.
 */
const inferObstacleHint = (geometries: ObstacleGeometryConfig[]): ObstacleEditorHint => {
	const boundsHint = boundsHintFromWalls(geometries)
	if (boundsHint) return boundsHint

	const [only] = geometries
	if (geometries.length === 1 && only && !hasOffset(only)) return { type: 'simple' }

	return { type: 'complex' }
}

/**
 * Which editor opens an obstacle component, with the Bounds form's values when it is Bounds.
 * The `visualizer` hint decides when it fits the geometries: `complex` always, `simple` for
 * exactly one geometry, and `bounds` when it generates the stored walls. A missing, malformed or
 * stale hint falls back to reading the type from the geometries.
 */
export const obstacleEditorHint = (component: PartComponent): ObstacleEditorHint => {
	const geometries = obstacleGeometriesOf(component)
	const hint = component.visualizer

	if (hint?.type === 'complex') return { type: 'complex' }
	if (hint?.type === 'simple' && geometries.length === 1) return { type: 'simple' }

	const boundsHint = parseBoundsHint(hint)
	if (boundsHint && boundsWallsMatch(boundsHint, geometries)) return boundsHint

	return inferObstacleHint(geometries)
}

/** Which editor opens an obstacle component. See {@link obstacleEditorHint}. */
export const obstacleEditorType = (component: PartComponent): ObstacleEditorHint['type'] =>
	obstacleEditorHint(component).type
