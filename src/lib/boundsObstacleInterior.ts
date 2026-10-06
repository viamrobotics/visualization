import type { PartComponentPatch } from '$lib/hooks/patchPartComponent'
import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { type BoundsHint, isObstacleComponent } from '$lib/obstacleAttributes'
import { obstacleEditorHint } from '$lib/obstacleEditorType'
import { withObstacleHint } from '$lib/obstacleVisualizer'

/** A Bounds hint needs a positive interior, so a resize never goes below this. */
const MIN_INTERIOR_MM = 1

/** A Bounds obstacle's interior size, in mm. */
export interface BoundsInterior {
	x: number
	y: number
	z: number
}

/**
 * The part-owned Bounds obstacle named `name`, with its hint, stored or read from its walls. Its
 * interior is what a scale gizmo resizes, since the obstacle's own frame carries no geometry.
 */
export const boundsObstacleNamed = (
	components: PartComponent[] | undefined,
	name: string | undefined
): { component: PartComponent; hint: BoundsHint } | undefined => {
	const component = components?.find((candidate) => candidate.name === name)
	if (!component || !isObstacleComponent(component)) return undefined

	const hint = obstacleEditorHint(component)
	return hint.type === 'bounds' ? { component, hint } : undefined
}

/** The interior size a Bounds hint records. */
export const boundsHintInterior = (hint: BoundsHint): BoundsInterior => ({
	x: hint.x_mm,
	y: hint.y_mm,
	z: hint.z_mm,
})

/**
 * The edit that resizes a Bounds obstacle to `interior` and regenerates its walls around it. The
 * wall thickness and the walls left out are kept.
 */
export const resizeBoundsObstacle = (
	component: PartComponent,
	hint: BoundsHint,
	interior: BoundsInterior
): PartComponentPatch => {
	const next: BoundsHint = {
		...hint,
		x_mm: Math.max(MIN_INTERIOR_MM, interior.x),
		y_mm: Math.max(MIN_INTERIOR_MM, interior.y),
		z_mm: Math.max(MIN_INTERIOR_MM, interior.z),
	}

	return {
		attributes: { ...component.attributes, geometries: generateBoundsGeometries(next) },
		visualizer: withObstacleHint(component, next),
	}
}
