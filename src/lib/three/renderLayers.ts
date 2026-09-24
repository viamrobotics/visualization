import type { TransformControls } from 'three/addons/controls/TransformControls.js'

/** Helpers that belong in the interactive editor view, but not sensor/POV views. */
export const TRANSFORM_CONTROLS_LAYER = 1

export const isolateTransformControls = (controls: TransformControls) => {
	controls.getHelper().traverse((object) => object.layers.set(TRANSFORM_CONTROLS_LAYER))
	controls.getRaycaster().layers.enable(TRANSFORM_CONTROLS_LAYER)
}
