import type { Entity } from 'koota'

import { useThrelte } from '@threlte/core/webgpu'
import { Not } from 'koota'

import { focusCameraOnEntities } from '#lib/components/Entities/focusCameraOnEntities.js'
import { traits, useWorld } from '#lib/ecs/index.js'
import { worldMatricesSettled } from '#lib/ecs/worldMatrix.js'

import { useCameraControls } from './useControls.svelte'

interface Camera {
	/**
	 * Moves the camera to frame `entities`, keeping the current viewing angle. With no argument it
	 * frames everything visible, as the "Fit scene in view" button does. Does nothing before the
	 * camera exists or when nothing given has bounds.
	 *
	 * Measures once queued world matrix updates have landed, so content spawned or reparented just
	 * before the call is framed where it ends up.
	 *
	 * @returns Resolves once the camera move has started.
	 */
	fit(entities?: readonly Entity[]): Promise<void>
}

/** The visualizer's camera, for any component rendered inside `<Visualizer>`. */
export const useCamera = (): Camera => {
	const { scene } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()

	return {
		async fit(entities) {
			await worldMatricesSettled(world)
			focusCameraOnEntities(
				cameraControls.current,
				scene,
				entities ?? world.query(traits.WorldMatrix, Not(traits.InheritedInvisible))
			)
		},
	}
}
