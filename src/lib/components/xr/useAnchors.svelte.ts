import { useTask, useThrelte } from '@threlte/core'
import { useXR } from '@threlte/xr'
import { getContext, setContext } from 'svelte'
import { fromStore } from 'svelte/store'
import { type Object3D, type Quaternion, type Vector3 } from 'three'

const key = Symbol('anchors-context')

interface Context {
	createAnchor: (position: Vector3, orientation: Quaternion) => Promise<XRAnchor> | undefined
	bindAnchorObject: (anchor: XRAnchor, object: Object3D) => void
	unbindAnchorObject: (anchor: XRAnchor) => void
	persist: (anchor: XRAnchor) => Promise<string | undefined>
	restore: (uuid: string) => Promise<XRAnchor | undefined>
	remove: (uuid: string) => Promise<void>
	getAnchorPose: (anchor: XRAnchor) => XRPose | undefined
}

export const provideAnchors = () => {
	const { renderer } = useThrelte()
	const { isPresenting: isPresentingStore } = useXR()
	const isPresenting = fromStore(isPresentingStore)

	const map = new WeakMap<XRAnchor, Object3D>()

	const createAnchor = (position: Vector3, quaternion: Quaternion) => {
		const space = renderer.xr.getReferenceSpace()
		const frame = renderer.xr.getFrame()

		if (!space || !frame) return

		const pose = new XRRigidTransform(
			{ x: position.x, y: position.y, z: position.z },
			{ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
		)

		return frame.createAnchor?.(pose, space)
	}

	const bindAnchorObject = (anchor: XRAnchor, object: Object3D) => {
		map.set(anchor, object)
	}

	const unbindAnchorObject = (anchor: XRAnchor) => {
		map.delete(anchor)
	}

	const persist = async (anchor: XRAnchor) => {
		return anchor.requestPersistentHandle?.()
	}

	const restore = async (uuid: string) => {
		const session = renderer.xr.getSession() as XRSession | null
		return session?.restorePersistentAnchor?.(uuid)
	}

	const remove = async (uuid: string) => {
		const session = renderer.xr.getSession() as XRSession | null
		await session?.deletePersistentAnchor?.(uuid)
	}

	const getAnchorPose = (anchor: XRAnchor) => {
		const space = renderer.xr.getReferenceSpace()
		const frame = renderer.xr.getFrame()
		if (!space || !frame) return
		return frame.getPose(anchor.anchorSpace, space)
	}

	useTask(
		() => {
			const space = renderer.xr.getReferenceSpace()
			const frame = renderer.xr.getFrame()

			if (!space || !frame?.trackedAnchors) {
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

				object3d.matrixAutoUpdate = false
				object3d.matrix.fromArray(anchorPose.transform.matrix)
			}
		},
		{
			running: () => isPresenting.current,
		}
	)

	setContext<Context>(key, {
		createAnchor,
		bindAnchorObject,
		unbindAnchorObject,
		persist,
		restore,
		remove,
		getAnchorPose,
	})
}

export const useAnchors = () => {
	return getContext<Context>(key)
}
