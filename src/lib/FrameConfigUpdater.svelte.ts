import type { Frame } from './frame'
import type { WorldObject } from './lib'
import { createPose } from './transform'
import type { Geometries } from './WorldObject.svelte'
import type { Pose } from '@viamrobotics/sdk'

type UpdateFrameCallback = {
	(componentName: string, referenceFrame: string, pose: Pose, geometry?: Frame['geometry']): void
}

type RemoveFrameCallback = {
	(componentName: string): void
}

export class FrameConfigUpdater {
	private object: () => WorldObject<Geometries> | undefined
	private referenceFrame: () => string
	private updateFrame: UpdateFrameCallback
	private removeFrame: RemoveFrameCallback

	constructor(
		object: () => WorldObject<Geometries> | undefined,
		updateFrame: UpdateFrameCallback,
		removeFrame: RemoveFrameCallback,
		referenceFrame: () => string
	) {
		this.referenceFrame = referenceFrame
		this.object = object
		this.updateFrame = updateFrame
		this.removeFrame = removeFrame
	}

	public updateLocalPosition = ({ x, y, z }: { x?: number; y?: number; z?: number }) => {
		const object = this.object()
		if (!object) return
		object.localEditedPose.x = x ?? object.localEditedPose.x
		object.localEditedPose.y = y ?? object.localEditedPose.y
		object.localEditedPose.z = z ?? object.localEditedPose.z

		this.updateFrame(object.name ?? '', this.referenceFrame(), {
			x: x ?? object.localEditedPose.x,
			y: y ?? object.localEditedPose.y,
			z: z ?? object.localEditedPose.z,
			oX: object.localEditedPose.oX,
			oY: object.localEditedPose.oY,
			oZ: object.localEditedPose.oZ,
			theta: object.localEditedPose.theta,
		})
	}

	public updateLocalOrientation = ({
		oX,
		oY,
		oZ,
		theta,
	}: {
		oX?: number
		oY?: number
		oZ?: number
		theta?: number
	}) => {
		const object = this.object()
		if (!object) return

		object.localEditedPose.oX = oX ?? object.localEditedPose.oX
		object.localEditedPose.oY = oY ?? object.localEditedPose.oY
		object.localEditedPose.oZ = oZ ?? object.localEditedPose.oZ
		object.localEditedPose.theta = theta ?? object.localEditedPose.theta

		this.updateFrame(object.name ?? '', this.referenceFrame(), {
			oX: oX ?? object.localEditedPose.oX,
			oY: oY ?? object.localEditedPose.oY,
			oZ: oZ ?? object.localEditedPose.oZ,
			theta: theta ?? object.localEditedPose.theta,
			x: object.localEditedPose.x,
			y: object.localEditedPose.y,
			z: object.localEditedPose.z,
		})
	}

	public updateGeometry = (geometry: Partial<Frame['geometry']>) => {
		const object = this.object()
		if (!object) return

		let geometryObject: Frame['geometry']

		if (geometry?.type === 'box') {
			const currentGeometry = object.geometry?.geometryType.value as {
				dimsMm: { x: number; y: number; z: number }
			}
			geometryObject = {
				type: 'box',
				x: geometry.x ?? currentGeometry?.dimsMm?.x,
				y: geometry.y ?? currentGeometry?.dimsMm?.y,
				z: geometry.z ?? currentGeometry?.dimsMm?.z,
			}
		} else if (geometry?.type === 'sphere') {
			const currentGeometry = object.geometry?.geometryType.value as { radiusMm: number }
			geometryObject = {
				type: 'sphere',
				r: geometry.r ?? currentGeometry?.radiusMm,
			}
		} else if (geometry?.type === 'capsule') {
			const currentGeometry = object.geometry?.geometryType.value as {
				radiusMm: number
				lengthMm: number
			}
			geometryObject = {
				type: 'capsule',
				r: geometry.r ?? currentGeometry?.radiusMm,
				l: geometry.l ?? currentGeometry?.lengthMm,
			}
		}

		this.updateFrame(
			object.name ?? '',
			this.referenceFrame(),
			createPose(object.localEditedPose),
			geometryObject
		)
	}

	public setFrameParent = (parentName: string) => {
		const object = this.object()
		if (!object) return
		this.updateFrame(object.name ?? '', parentName, createPose(object.localEditedPose))
	}

	public deleteFrame = () => {
		const object = this.object()
		if (!object) return
		this.removeFrame(object.name ?? '')
	}

	public setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		const object = this.object()
		if (!object) return
		if (type === 'none') {
			this.updateFrame(
				object.name ?? '',
				this.referenceFrame(),
				createPose(object.localEditedPose),
				{ type: 'none' }
			)
		} else if (type === 'box') {
			this.updateFrame(
				object.name ?? '',
				this.referenceFrame(),
				createPose(object.localEditedPose),
				{ type: 'box', x: 100, y: 100, z: 100 }
			)
		} else if (type === 'sphere') {
			this.updateFrame(
				object.name ?? '',
				this.referenceFrame(),
				createPose(object.localEditedPose),
				{ type: 'sphere', r: 100 }
			)
		} else if (type === 'capsule') {
			this.updateFrame(
				object.name ?? '',
				this.referenceFrame(),
				{
					x: object.localEditedPose.x,
					y: object.localEditedPose.y,
					z: object.localEditedPose.z,
					oX: object.localEditedPose.oX,
					oY: object.localEditedPose.oY,
					oZ: object.localEditedPose.oZ,
					theta: object.localEditedPose.theta,
				},
				{ type: 'capsule', r: 20, l: 100 }
			)
		}
	}
}
