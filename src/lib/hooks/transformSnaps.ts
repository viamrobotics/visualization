import { MathUtils } from 'three'

import type { Settings } from './useSettings.svelte'

// The settings speak the app's units (mm, degrees), the gizmo the scene's (metres, radians).
const METRES_PER_MILLIMETRE = 0.001

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
		translation: step(settings.snapTranslate, (mm) => mm * METRES_PER_MILLIMETRE),
		rotation: step(settings.snapRotate, (degrees) => MathUtils.degToRad(degrees)),
		scale: step(settings.snapScale, (factor) => factor),
	}
}
