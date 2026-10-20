import type { PlainMessage } from '@bufbuild/protobuf'

import type { Primitive } from '$lib/buf/kinematics/v1/spec_pb'

const format = (value: number): string => String(Math.round(value * 10) / 10)

/** A primitive collision shape with its dimensions in millimetres, or `undefined` when unset. */
export const formatPrimitive = (
	primitive: PlainMessage<Primitive> | undefined
): string | undefined => {
	const shape = primitive?.shape
	switch (shape?.case) {
		case 'box': {
			return `Box ${format(shape.value.x)} × ${format(shape.value.y)} × ${format(shape.value.z)} mm`
		}
		case 'sphere': {
			return `Sphere r ${format(shape.value.radius)} mm`
		}
		case 'capsule': {
			return `Capsule r ${format(shape.value.radius)}, length ${format(shape.value.length)} mm`
		}
		case 'cylinder': {
			return `Cylinder r ${format(shape.value.radius)}, length ${format(shape.value.length)} mm`
		}
		default: {
			return undefined
		}
	}
}
