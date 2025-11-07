import type { Entity } from 'koota'
import type { Pose } from '@viamrobotics/sdk'
import type { Frame } from '$lib/frame'
import { createPose } from '$lib/transform'
import { traits } from '$lib/ecs'

type UpdateFrameCallback = {
	(componentName: string, referenceFrame: string, pose: Pose, geometry?: Frame['geometry']): void
}

type RemoveFrameCallback = {
	(componentName: string): void
}

export class FrameConfigUpdater {
	private entity: () => Entity | undefined
	private referenceFrame: () => string
	private updateFrame: UpdateFrameCallback
	private removeFrame: RemoveFrameCallback

	constructor(
		entity: () => Entity | undefined,
		updateFrame: UpdateFrameCallback,
		removeFrame: RemoveFrameCallback,
		referenceFrame: () => string
	) {
		this.referenceFrame = referenceFrame
		this.entity = entity
		this.updateFrame = updateFrame
		this.removeFrame = removeFrame
	}

	public updateLocalPosition = ({ x, y, z }: { x?: number; y?: number; z?: number }) => {
		const entity = this.entity()
		if (!entity) return

		x = this.sanatizeFloatValue(x)
		y = this.sanatizeFloatValue(y)
		z = this.sanatizeFloatValue(z)

		if (x === undefined && y === undefined && z === undefined) return

		entity.set(traits.EditedPose, { x, y, z })

		const name = entity.get(traits.Name)?.name
		const updatedPose = entity.get(traits.EditedPose)

		if (name && updatedPose) {
			this.updateFrame(name, this.referenceFrame(), updatedPose)
		}
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
		const entity = this.entity()
		if (!entity) return

		oX = this.sanatizeFloatValue(oX)
		oY = this.sanatizeFloatValue(oY)
		oZ = this.sanatizeFloatValue(oZ)
		theta = this.sanatizeFloatValue(theta)

		if (oX === undefined && oY === undefined && oZ === undefined && theta === undefined) {
			return
		}

		entity.set(traits.EditedPose, { oX, oY, oZ, theta })

		const name = entity.get(traits.Name)?.name
		const updatedPose = entity.get(traits.EditedPose)

		if (name && updatedPose) {
			this.updateFrame(name, this.referenceFrame(), updatedPose)
		}
	}

	public updateGeometry = (geometry: Partial<Frame['geometry']>) => {
		const entity = this.entity()
		if (!entity) return

		if (geometry?.type === 'box') {
			const x = this.sanatizeFloatValue(geometry.x)
			const y = this.sanatizeFloatValue(geometry.y)
			const z = this.sanatizeFloatValue(geometry.z)

			if (x === undefined && y === undefined && z === undefined) return

			entity.set(traits.Box, { x, y, z })

			const name = entity.get(traits.Name)?.name
			const box = entity.get(traits.Box)
			const pose = entity.get(traits.EditedPose)

			if (name && box && pose) {
				this.updateFrame(name, this.referenceFrame(), pose, { type: 'box', ...box })
			}
		} else if (geometry?.type === 'sphere') {
			const r = this.sanatizeFloatValue(geometry.r)
			if (r === undefined) return

			entity.set(traits.Sphere, { r })

			const name = entity.get(traits.Name)?.name
			const sphere = entity.get(traits.Sphere)
			const pose = entity.get(traits.EditedPose)

			if (name && sphere && pose) {
				this.updateFrame(name, this.referenceFrame(), pose, { type: 'sphere', ...sphere })
			}
		} else if (geometry?.type === 'capsule') {
			const r = this.sanatizeFloatValue(geometry.r)
			const l = this.sanatizeFloatValue(geometry.l)
			if (r === undefined && l === undefined) return

			entity.set(traits.Capsule, { r, l })

			const name = entity.get(traits.Name)?.name
			const capsule = entity.get(traits.Capsule)
			const pose = entity.get(traits.EditedPose)

			if (name && capsule && pose) {
				this.updateFrame(name, this.referenceFrame(), pose, { type: 'sphere', ...capsule })
			}
		}
	}

	public setFrameParent = (parentName: string) => {
		const entity = this.entity()
		if (!entity) return

		const name = entity.get(traits.Name)?.name
		const pose = entity.get(traits.EditedPose)

		if (name && pose) {
			this.updateFrame(name, parentName, pose)
		}
	}

	public deleteFrame = () => {
		const entity = this.entity()
		if (!entity) return

		const name = entity.get(traits.Name)?.name

		if (name) {
			this.removeFrame(name)
		}
	}

	public setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		const entity = this.entity()
		if (!entity) return

		const name = entity.get(traits.Name)?.name
		const pose = entity.get(traits.EditedPose)

		if (!name || !pose) return

		if (type === 'none') {
			this.updateFrame(name, this.referenceFrame(), pose, { type: 'none' })
		} else if (type === 'box') {
			this.updateFrame(name, this.referenceFrame(), pose, { type: 'box', x: 100, y: 100, z: 100 })
		} else if (type === 'sphere') {
			this.updateFrame(name, this.referenceFrame(), pose, { type: 'sphere', r: 100 })
		} else if (type === 'capsule') {
			this.updateFrame(name, this.referenceFrame(), pose, { type: 'capsule', r: 20, l: 100 })
		}
	}

	private sanatizeFloatValue = (value?: number) => {
		if (value === undefined) return undefined
		const num = parseFloat(value.toFixed(2))
		if (isNaN(num)) return undefined
		return num
	}
}
