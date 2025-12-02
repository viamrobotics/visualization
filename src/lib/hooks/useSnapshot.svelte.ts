import { getContext, setContext } from 'svelte'
import { getArmModelRendering } from '$lib/snapshot'
import { RenderArmModels } from '$lib/gen/draw/v1/scene_pb'
import { Snapshot } from '$lib/gen/draw/v1/snapshot_pb'
import { useSettings } from './useSettings.svelte'
import { useCameraControls, type CameraPose } from './useControls.svelte'
import { drawingWithUUID, fromDrawing, fromTransform, WorldObject } from '$lib/WorldObject.svelte'
import { Geometry, transformWithUUID } from '@viamrobotics/sdk'
import { rgbaToHex } from '$lib/color'

const key = Symbol('snapshot-context')

type FrameGeometry = Geometry & { geometryType: { case: undefined; value: undefined } }

interface Context {
	current: Snapshot | undefined
	frames: WorldObject<FrameGeometry>[]
	worldObjects: WorldObject[]
}

export const provideSnapshot = () => {
	const settings = useSettings()
	const cameraControls = useCameraControls()

	let snapshot = $state.raw<Snapshot>()
	let frames = $state.raw<WorldObject<FrameGeometry>[]>([])
	let worldObjects = $state.raw<WorldObject[]>([])

	const cameraPose = $derived.by((): CameraPose => {
		const camera = snapshot?.sceneMetadata?.sceneCamera
		if (!camera) return { position: [3, 3, 3], lookAt: [0, 0, 0] }

		return {
			position: [
				(camera.position?.x ?? 0) * 0.001,
				(camera.position?.y ?? 0) * 0.001,
				(camera.position?.z ?? 0) * 0.001,
			],
			lookAt: [
				(camera.lookAt?.x ?? 0) * 0.001,
				(camera.lookAt?.y ?? 0) * 0.001,
				(camera.lookAt?.z ?? 0) * 0.001,
			],
		}
	})

	$effect(() => {
		const metadata = snapshot?.sceneMetadata
		if (!metadata) return

		settings.current.grid = metadata.grid ?? settings.current.grid
		settings.current.gridCellSize = metadata.gridCellSize
			? metadata.gridCellSize * 0.001
			: settings.current.gridCellSize
		settings.current.gridSectionSize = metadata.gridSectionSize
			? metadata.gridSectionSize * 0.001
			: settings.current.gridSectionSize
		settings.current.gridFadeDistance = metadata.gridFadeDistance
			? metadata.gridFadeDistance * 0.001
			: settings.current.gridFadeDistance

		settings.current.pointSize = metadata.pointSize
			? metadata.pointSize * 0.001
			: settings.current.pointSize
		settings.current.pointColor = metadata.pointColor
			? rgbaToHex(Array.from(metadata.pointColor))
			: settings.current.pointColor

		settings.current.lineWidth = metadata.lineWidth
			? metadata.lineWidth * 0.001
			: settings.current.lineWidth
		settings.current.lineDotSize = metadata.linePointSize
			? metadata.linePointSize * 0.001
			: settings.current.lineDotSize

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

	$effect(() => {
		if (!snapshot) {
			frames = []
			worldObjects = []
			return
		}

		const nextFrames: WorldObject<FrameGeometry>[] = []
		const nextWorldObjects: WorldObject[] = []

		for (const transform of snapshot.transforms) {
			const withUUID = transformWithUUID(transform)
			if (!withUUID.physicalObject || withUUID.physicalObject.geometryType.case === undefined) {
				nextFrames.push(
					fromTransform(withUUID) as WorldObject<
						Geometry & { geometryType: { case: undefined; value: undefined } }
					>
				)
			} else {
				const worldObject = fromTransform(withUUID)
				nextWorldObjects.push(worldObject)
			}
		}

		for (const drawing of snapshot.drawings) {
			const withUUID = drawingWithUUID(drawing)
			nextWorldObjects.push(fromDrawing(withUUID))
		}

		frames = nextFrames
		worldObjects = nextWorldObjects
	})

	return setContext<Context>(key, {
		get current() {
			return snapshot
		},

		set current(value: Snapshot | undefined) {
			snapshot = value
		},

		get frames() {
			return frames
		},

		get worldObjects() {
			return worldObjects
		},
	})
}

export const useSnapshot = () => {
	return getContext<Context>(key)
}
