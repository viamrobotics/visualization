import type { Entity } from 'koota'
import type { Pose } from '@viamrobotics/sdk'
import type { Frame } from '$lib/frame'
import { traits } from '$lib/ecs'
import type { Vector3Like } from 'three'

type UpdateFrameCallback = {
	(componentName: string, referenceFrame: string, pose: Pose, geometry?: Frame['geometry']): void
}

type RemoveFrameCallback = {
	(componentName: string): void
}

export class FrameConfigUpdater {
	private updateFrame: UpdateFrameCallback
	private removeFrame: RemoveFrameCallback

	constructor(updateFrame: UpdateFrameCallback, removeFrame: RemoveFrameCallback) {
		this.updateFrame = updateFrame
		this.removeFrame = removeFrame
	}

	public updateLocalPosition = (entity: Entity, position: Partial<Vector3Like>) => {
		const x = this.sanitizeFloatValue(position.x)
		const y = this.sanitizeFloatValue(position.y)
		const z = this.sanitizeFloatValue(position.z)

		if (x === undefined && y === undefined && z === undefined) return

		const change: { x?: number; y?: number; z?: number } = {}
		if (x !== undefined) change.x = x
		if (y !== undefined) change.y = y
		if (z !== undefined) change.z = z

		entity.set(traits.EditedPose, change)

		const name = entity.get(traits.Name)
		const parent = entity.get(traits.EditedParent) ?? 'world'
		const updatedPose = entity.get(traits.EditedPose)

		if (name && updatedPose) {
			this.updateFrame(name, parent, updatedPose)
		}
	}

	public updateLocalOrientation = (
		entity: Entity,
		orientation: {
			oX?: number
			oY?: number
			oZ?: number
			theta?: number
		}
	) => {
		const oX = this.sanitizeFloatValue(orientation.oX)
		const oY = this.sanitizeFloatValue(orientation.oY)
		const oZ = this.sanitizeFloatValue(orientation.oZ)
		const theta = this.sanitizeFloatValue(orientation.theta)

		if (oX === undefined && oY === undefined && oZ === undefined && theta === undefined) {
			return
		}

		const change: { oX?: number; oY?: number; oZ?: number; theta?: number } = {}
		if (oX !== undefined) change.oX = oX
		if (oY !== undefined) change.oY = oY
		if (oZ !== undefined) change.oZ = oZ
		if (theta !== undefined) change.theta = theta

		entity.set(traits.EditedPose, change)

		const name = entity.get(traits.Name)
		const parent = entity.get(traits.EditedParent) ?? 'world'
		const updatedPose = entity.get(traits.EditedPose)

		if (name && updatedPose) {
			this.updateFrame(name, parent, updatedPose)
		}
	}

	public updateGeometry = (entity: Entity, geometry: Partial<Frame['geometry']>) => {
		const name = entity.get(traits.Name)
		const parent = entity.get(traits.EditedParent) ?? 'parent'
		const pose = entity.get(traits.EditedPose)

		if (geometry?.type === 'box') {
			const x = this.sanitizeFloatValue(geometry.x)
			const y = this.sanitizeFloatValue(geometry.y)
			const z = this.sanitizeFloatValue(geometry.z)

			if (x === undefined && y === undefined && z === undefined) return

			const change: { x?: number; y?: number; z?: number } = {}
			if (x !== undefined) change.x = x
			if (y !== undefined) change.y = y
			if (z !== undefined) change.z = z

			entity.set(traits.Box, change)

			const box = entity.get(traits.Box)

			if (name && box && pose) {
				this.updateFrame(name, parent, pose, { type: 'box', ...box })
			}
		} else if (geometry?.type === 'sphere') {
			const r = this.sanitizeFloatValue(geometry.r)

			if (r === undefined) return

			entity.set(traits.Sphere, { r })

			const sphere = entity.get(traits.Sphere)

			if (name && sphere && pose) {
				this.updateFrame(name, parent, pose, { type: 'sphere', ...sphere })
			}
		} else if (geometry?.type === 'capsule') {
			const r = this.sanitizeFloatValue(geometry.r)
			const l = this.sanitizeFloatValue(geometry.l)

			if (r === undefined && l === undefined) return

			const change: { r?: number; l?: number } = {}
			if (r !== undefined) change.r = r
			if (l !== undefined) change.l = l

			entity.set(traits.Capsule, { r, l })

			const capsule = entity.get(traits.Capsule)

			if (name && capsule && pose) {
				this.updateFrame(name, parent, pose, { type: 'sphere', ...capsule })
			}
		}
	}

	public setFrameParent = (entity: Entity, parentName: string) => {
		const name = entity.get(traits.Name)
		const pose = entity.get(traits.EditedPose)

		if (name && pose) {
			this.updateFrame(name, parentName, pose)
		}
	}

	public deleteFrame = (entity: Entity) => {
		const name = entity.get(traits.Name)

		if (name) {
			this.removeFrame(name)
		}
	}

	public setGeometryType = (entity: Entity, type: 'none' | 'box' | 'sphere' | 'capsule') => {
		const name = entity.get(traits.Name)
		const parent = entity.get(traits.EditedParent) ?? 'world'
		const pose = entity.get(traits.EditedPose)

		if (!name || !pose) return

		if (type === 'none') {
			this.updateFrame(name, parent, pose, { type: 'none' })
		} else if (type === 'box') {
			this.updateFrame(name, parent, pose, { type: 'box', x: 100, y: 100, z: 100 })
		} else if (type === 'sphere') {
			this.updateFrame(name, parent, pose, { type: 'sphere', r: 100 })
		} else if (type === 'capsule') {
			this.updateFrame(name, parent, pose, { type: 'capsule', r: 20, l: 100 })
		}
	}

	private sanitizeFloatValue = (value?: number): number | undefined => {
		if (value === undefined) {
			return undefined
		}

		const num = parseFloat(value.toFixed(2))

		if (Number.isNaN(num)) {
			return undefined
		}

		return value
	}
}
