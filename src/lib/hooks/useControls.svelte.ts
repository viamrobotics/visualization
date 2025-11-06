import type { CameraControlsRef } from '@threlte/extras'
import { getContext, setContext } from 'svelte'
import type { Vector3Tuple } from 'three'

const TRANSFORM_CONTROLS_KEY = Symbol('tranform-controls-context')
const CAMERA_CONTROLS_KEY = Symbol('camera-controls-context')

export interface CameraPose {
	position: Vector3Tuple
	lookAt: Vector3Tuple
}

interface CameraControlsContext {
	current: CameraControlsRef | undefined
	set(current: CameraControlsRef): void
	setPose(pose: CameraPose, animate?: boolean): void
}

export const provideCameraControls = (cameraPose: () => CameraPose | undefined) => {
	let controls = $state.raw<CameraControlsRef>()

	const setPose = (pose: CameraPose, animate = false) => {
		const [x, y, z] = pose.position
		const [lookAtX, lookAtY, lookAtZ] = pose.lookAt

		controls?.setPosition(x, y, z, animate)
		controls?.setLookAt(x, y, z, lookAtX, lookAtY, lookAtZ, animate)
	}

	$effect(() => {
		const pose = cameraPose()

		if (pose) {
			setPose(pose)
		}
	})

	setContext<CameraControlsContext>(CAMERA_CONTROLS_KEY, {
		get current() {
			return controls
		},
		set(current: CameraControlsRef) {
			controls = current
		},
		setPose,
	})
}

export const useCameraControls = (): CameraControlsContext => {
	return getContext<CameraControlsContext>(CAMERA_CONTROLS_KEY)
}

interface TransformControlsContext {
	active: boolean
	setActive: (value: boolean) => void
}

export const provideTransformControls = () => {
	let active = $state(false)

	setContext<TransformControlsContext>(TRANSFORM_CONTROLS_KEY, {
		get active() {
			return active
		},
		setActive(value: boolean) {
			active = value
		},
	})
}

export const useTransformControls = (): TransformControlsContext => {
	return getContext<TransformControlsContext>(TRANSFORM_CONTROLS_KEY)
}
