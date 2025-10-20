import type { Geometry } from '@viamrobotics/sdk'
import { createPose } from './transform'

export const createGeometry = (geometryType?: Geometry['geometryType'], label = ''): Geometry => {
	return {
		center: createPose(),
		label,
		geometryType: geometryType ?? { case: undefined, value: undefined },
	}
}
