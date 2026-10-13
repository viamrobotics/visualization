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
	const snap = (value: number, convert: (v: number) => number = (v) => v) =>
		settings.snapping && value > 0 ? convert(value) : null

	return {
		translation: snap(settings.snapTranslate),
		rotation: snap(settings.snapRotate, MathUtils.degToRad),
		scale: snap(settings.snapScale),
	}
}
