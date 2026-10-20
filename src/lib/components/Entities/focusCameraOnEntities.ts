import type { CameraControlsRef } from '@threlte/extras'
import type { Entity } from 'koota'
import type { Object3D } from 'three'

import { Box3 } from 'three'

import { expandBoxByEntity } from './expandBoxByEntity'

/** Fraction of the framed bounds left as empty space on each side of the viewport. */
const FIT_PADDING = 0.4

const bounds = new Box3()

/**
 * Moves the camera to frame `entities`, holding the scene's current viewing angle.
 * Entities whose bounds cannot be resolved contribute nothing, and the camera holds
 * still when none of them can.
 */
export const focusCameraOnEntities = (
	controls: CameraControlsRef | undefined,
	scene: Object3D,
	entities: readonly Entity[]
): void => {
	if (!controls) return

	bounds.makeEmpty()

	for (const entity of entities) {
		expandBoxByEntity(bounds, entity, scene)
	}

	if (bounds.isEmpty()) return

	// `fitToBox` rotates to face the box, which reorients a scene the user already
	// aimed. Capture the angles first and rotate back within the same transition.
	const { azimuthAngle, polarAngle } = controls

	controls.fitToBox(bounds, true, {
		paddingTop: FIT_PADDING,
		paddingBottom: FIT_PADDING,
		paddingLeft: FIT_PADDING,
		paddingRight: FIT_PADDING,
	})

	controls.rotateAzimuthTo(azimuthAngle, true)
	controls.rotatePolarTo(polarAngle, true)
}
