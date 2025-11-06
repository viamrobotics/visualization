import { useTask, useThrelte, watch } from '@threlte/core'
import { useXR } from '@threlte/xr'
import { getContext, setContext } from 'svelte'
import { Matrix4, type Object3D, type Quaternion, type Vector3 } from 'three'

const key = Symbol('anchors-context')

interface Context {
	createAnchor: (position: Vector3, orientation: Quaternion) => Promise<XRAnchor> | undefined
}

export const provideAnchors = () => {
	const matrix4 = new Matrix4()
	const { renderer } = useThrelte()
	const { xrFrame, isPresenting } = useXR()
	const map = new WeakMap<XRAnchor, Object3D>()

	let space = renderer.xr.getReferenceSpace()

	const createAnchor = (position: Vector3, orientation: Quaternion) => {
		space ??= renderer.xr.getReferenceSpace()

		if (space === null) return

		const pose = new XRRigidTransform(position, orientation)
		return xrFrame.current.createAnchor?.(pose, space)
	}

	const { start, stop } = useTask(() => {
		space ??= renderer.xr.getReferenceSpace()

		if (!space) {
			return
		}

		const frame = xrFrame.current

		if (!frame.trackedAnchors) {
			return
		}

		for (const anchor of frame.trackedAnchors) {
			const object3d = map.get(anchor)

			if (!object3d) {
				continue
			}

			const anchorPose = frame.getPose(anchor.anchorSpace, space)

			if (!anchorPose) {
				continue
			}

			matrix4.fromArray(anchorPose.transform.matrix)
			object3d.applyMatrix4(matrix4)
		}
	})

	watch(isPresenting, ($isPresenting) => {
		if ($isPresenting) {
			start()
		} else {
			stop()
		}
	})

	setContext<Context>(key, {
		createAnchor,
	})
}

export const useAnchors = () => {
	getContext<Context>(key)
}
