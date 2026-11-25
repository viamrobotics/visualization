import type { Entity } from 'koota'

import { useThrelte } from '@threlte/core/webgpu'
import { Not } from 'koota'

import { focusCameraOnEntities } from '#lib/components/Entities/focusCameraOnEntities.js'
import { traits, useWorld } from '#lib/ecs/index.js'

import { useCameraControls } from './useControls.svelte'

interface Camera {
	/**
	 * Moves the camera to frame `entities`, keeping the current viewing angle. With no argument it
	 * frames everything visible, as the "Fit scene in view" button does. Does nothing before the
	 * camera exists or when nothing given has bounds.
	 */
	fit(entities?: readonly Entity[]): void
}

/** The visualizer's camera, for any component rendered inside `<Visualizer>`. */
export const useCamera = (): Camera => {
	const { scene } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()

	return {
		fit(entities) {
			focusCameraOnEntities(
				cameraControls.current,
				scene,
				entities ?? world.query(traits.WorldMatrix, Not(traits.InheritedInvisible))
			)
		},
	}
}
