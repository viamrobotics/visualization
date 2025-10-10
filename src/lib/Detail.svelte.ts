import type { WorldObject } from './lib'
import type { Geometries } from './WorldObject.svelte'
import type { Pose } from '@viamrobotics/sdk'

type UpdateFrameCallback = {
	(
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: {
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	): void
}
export class DetailConfigUpdater {
	private object: () => WorldObject<Geometries> | undefined
	private referenceFrame: () => string
	private updateFrame: UpdateFrameCallback

	constructor(
		object: () => WorldObject<Geometries> | undefined,
		updateFrame: UpdateFrameCallback,
		referenceFrame: () => string
	) {
		this.referenceFrame = referenceFrame
		this.object = object
		this.updateFrame = updateFrame
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

	public updateGeometry = (geometry: {
		type: 'none' | 'box' | 'sphere' | 'capsule'
		r?: number
		l?: number
		x?: number
		y?: number
		z?: number
	}) => {
		const object = this.object()
		if (!object) return
		let geometryObject: {
			type: 'box' | 'sphere' | 'capsule'
			x?: number
			y?: number
			z?: number
			r?: number
			l?: number
		}
		if (geometry.type === 'box') {
			const currentGeometry = object.geometry?.geometryType.value as {
				dimsMm: { x: number; y: number; z: number }
			}
			geometryObject = {
				type: 'box',
				x: geometry.x ?? currentGeometry?.dimsMm?.x,
				y: geometry.y ?? currentGeometry?.dimsMm?.y,
				z: geometry.z ?? currentGeometry?.dimsMm?.z,
			}
		} else if (geometry.type === 'sphere') {
			const currentGeometry = object.geometry?.geometryType.value as { radiusMm: number }
			geometryObject = {
				type: 'sphere',
				r: geometry.r ?? currentGeometry?.radiusMm,
			}
		} else if (geometry.type === 'capsule') {
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
			{
				x: object.localEditedPose.x,
				y: object.localEditedPose.y,
				z: object.localEditedPose.z,
				oX: object.localEditedPose.oX,
				oY: object.localEditedPose.oY,
				oZ: object.localEditedPose.oZ,
				theta: object.localEditedPose.theta,
			},
			{ ...geometryObject! }
		)
	}

	public setFrameParent = (parentName: string) => {
		const object = this.object()
		if (!object) return
		this.updateFrame(object.name ?? '', parentName, {
			x: object.pose.x,
			y: object.pose.y,
			z: object.pose.z,
			oX: object.pose.oX,
			oY: object.pose.oY,
			oZ: object.pose.oZ,
			theta: object.pose.theta,
		})
	}

	public setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		const object = this.object()
		if (!object) return
		if (type === 'none') {
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
				{ type: 'none' }
			)
		} else if (type === 'box') {
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
				{ type: 'box', x: 100, y: 100, z: 100 }
			)
		} else if (type === 'sphere') {
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
