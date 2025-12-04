import type { Capsule, Geometry, RectangularPrism, Sphere } from '@viamrobotics/sdk'
import { createPose } from './transform'
import type { Frame } from './frame'

export const createGeometry = (geometryType?: Geometry['geometryType'], label = ''): Geometry => {
	return {
		center: createPose(),
		label,
		geometryType: geometryType ?? { case: undefined, value: undefined },
	}
}

export const createGeometryFromFrame = (frame: Partial<Frame>) => {
	if (!frame.geometry) {
		return
	}

	if (frame.geometry.type === 'box') {
		return createGeometry({
			case: 'box',
			value: {
				dimsMm: {
					x: frame.geometry.x,
					y: frame.geometry.y,
					z: frame.geometry.z,
				},
			},
		})
	}

	if (frame.geometry.type === 'sphere') {
		return createGeometry({
			case: 'sphere',
			value: {
				radiusMm: frame.geometry.r,
			},
		})
	}

	if (frame.geometry.type === 'capsule') {
		return createGeometry({
			case: 'capsule',
			value: {
				radiusMm: frame.geometry.r,
				lengthMm: frame.geometry.l,
			},
		})
	}
}

export const createBox = (box?: RectangularPrism) => {
	return {
		x: (box?.dimsMm?.x ?? 0) * 0.001,
		y: (box?.dimsMm?.y ?? 0) * 0.001,
		z: (box?.dimsMm?.z ?? 0) * 0.001,
	}
}

export const createCapsule = (capsule?: Capsule) => {
	return {
		r: (capsule?.radiusMm ?? 0) * 0.001,
		l: (capsule?.lengthMm ?? 0) * 0.001,
	}
}

export const createSphere = (sphere?: Sphere) => {
	return {
		r: (sphere?.radiusMm ?? 0) * 0.001,
	}
}
