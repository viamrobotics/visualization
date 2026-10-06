import { MathUtils } from 'three'

import type { Settings } from './useSettings.svelte'

/** A transform gizmo's snap steps in scene units, `null` for an axis that does not snap. */
export interface TransformSnaps {
	translation: number | null
	rotation: number | null
	scale: number | null
}

/**
 * The snap steps to hand a Three.js transform gizmo. Snapping off, or a step of 0,
 * leaves that axis free.
 */
export const transformSnaps = (
	settings: Pick<Settings, 'snapping' | 'snapTranslate' | 'snapRotate' | 'snapScale'>
): TransformSnaps => {
	const step = (value: number, toSceneUnits: (value: number) => number) =>
		settings.snapping && value > 0 ? toSceneUnits(value) : null

	return {
		translation: step(settings.snapTranslate, (metres) => metres),
		rotation: step(settings.snapRotate, (degrees) => MathUtils.degToRad(degrees)),
		scale: step(settings.snapScale, (factor) => factor),
	}
}
