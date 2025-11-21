import { getContext, setContext } from 'svelte'
import { getArmModelRendering, RenderArmModels, type PassSnapshot } from '$lib/snapshot'
import { useSettings } from './useSettings.svelte'
import { useCameraControls, type CameraPose } from './useControls.svelte'
import { fromTransform, WorldObject } from '$lib/WorldObject.svelte'
import { transformWithUUID } from '@viamrobotics/sdk'

const key = Symbol('snapshot-context')

interface Context {
	current: PassSnapshot | undefined
	worldObjects: WorldObject[]
}

export const provideSnapshot = () => {
	const settings = useSettings()
	const cameraControls = useCameraControls()

	let snapshot = $state.raw<PassSnapshot>()

	const cameraPose = $derived.by((): CameraPose => {
		const camera = snapshot?.sceneMetadata?.sceneCamera
		if (!camera) return { position: [3, 3, 3], lookAt: [0, 0, 0] }

		return {
			position: [
				(camera.position?.x ?? 0) / 1000,
				(camera.position?.y ?? 0) / 1000,
				(camera.position?.z ?? 0) / 1000,
			],
			lookAt: [
				(camera.lookAt?.x ?? 0) / 1000,
				(camera.lookAt?.y ?? 0) / 1000,
				(camera.lookAt?.z ?? 0) / 1000,
			],
		}
	})

	$effect(() => {
		const metadata = snapshot?.sceneMetadata
		if (!metadata) return

		settings.current.grid = metadata.grid ?? settings.current.grid
		settings.current.gridCellSize = metadata.gridCellSize ?? settings.current.gridCellSize
		settings.current.gridSectionSize = metadata.gridSectionSize ?? settings.current.gridSectionSize
		settings.current.gridFadeDistance =
			metadata.gridFadeDistance ?? settings.current.gridFadeDistance

		settings.current.pointSize = metadata.pointSize ?? settings.current.pointSize
		settings.current.pointColor = metadata.pointColor ?? settings.current.pointColor
		settings.current.lineWidth = metadata.lineWidth ?? settings.current.lineWidth
		settings.current.lineDotSize = metadata.lineDotSize ?? settings.current.lineDotSize

		settings.current.renderArmModels = getArmModelRendering(
			metadata.renderArmModels ?? RenderArmModels.COLLIDERS_AND_MODEL
		)
	})

	$effect(() => {
		if (cameraControls.current) {
			cameraControls.current.setPosition(
				cameraPose.position[0],
				cameraPose.position[1],
				cameraPose.position[2]
			)
			cameraControls.current.setLookAt(
				cameraPose.position[0],
				cameraPose.position[1],
				cameraPose.position[2],
				cameraPose.lookAt[0],
				cameraPose.lookAt[1],
				cameraPose.lookAt[2]
			)
		}
	})

	return setContext<Context>(key, {
		get current() {
			return snapshot
		},

		set current(value: PassSnapshot | undefined) {
			snapshot = value
		},

		get worldObjects() {
			if (!snapshot) return []
			return snapshot?.transforms.map((transform) => {
				const withUUID = transformWithUUID(transform)
				return fromTransform(withUUID)
			})
		},
	})
}

export const useSnapshot = () => {
	return getContext<Context>(key)
}
