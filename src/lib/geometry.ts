import type { Geometry } from '@viamrobotics/sdk'
import { createPose } from './transform'
import type { Frame } from './frame'

export const createGeometry = (geometryType?: Geometry['geometryType'], label = ''): Geometry => {
	return {
		center: createPose(),
		label,
		geometryType: geometryType ?? { case: undefined, value: undefined },
	}
}

export const createGeometryFromFrame = (frame: Frame) => {
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
