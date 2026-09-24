import type {
	Capsule,
	PointCloud,
	Geometry as RDKGeometry,
	Transform as RDKTransform,
	RectangularPrism,
	Sphere,
} from '@viamrobotics/sdk'

import { Pose } from '$lib/math'
import { inferGeometryType } from '$lib/math/geometryJson'

import type { Frame } from './frame'

/** Radius and tip-to-tip length in mm about the Z axis. `capped` false is an open tube. */
export interface Cylinder {
	radiusMm: number
	lengthMm: number
	capped: boolean
}

/**
 * The geometry union the scene works in: the SDK's, widened with the cylinder
 * case `common.v1.Geometry` has no room for (rdk's own `Cylinder.ToProtobuf`
 * panics over the same gap).
 *
 * A cylinder reaches the scene only through `deriveKinematicsFrames`, whose
 * transforms never leave this client, so one cannot end up in a request body.
 * Anything that writes to the wire takes `RDKGeometry` instead.
 */
export type Geometry = Omit<RDKGeometry, 'geometryType'> & {
	geometryType: RDKGeometry['geometryType'] | { case: 'cylinder'; value: Cylinder }
}

export type Transform = Omit<RDKTransform, 'physicalObject'> & {
	physicalObject?: Geometry
}

export const createGeometry = (
	geometryType?: RDKGeometry['geometryType'],
	label = ''
): RDKGeometry => {
	return {
		center: new Pose(),
		label,
		geometryType: geometryType ?? { case: undefined, value: undefined },
	}
}

/**
 * Reads a geometry the frame editor cannot write but rdk accepts: an untyped one
 * for rdk to infer, or a shape the SDK's `Geometry` union has no case for.
 */
const createGeometryFromRdkConfig = (raw: Record<string, unknown>): RDKGeometry | undefined => {
	const x = (raw.x as number) ?? 0
	const y = (raw.y as number) ?? 0
	const z = (raw.z as number) ?? 0
	const r = (raw.r as number) ?? 0
	const l = (raw.l as number) ?? 0

	switch (inferGeometryType(raw)) {
		case 'box': {
			return createGeometry({ case: 'box', value: { dimsMm: { x, y, z } } })
		}
		case 'capsule': {
			return createGeometry({ case: 'capsule', value: { radiusMm: r, lengthMm: l } })
		}
		case 'sphere': {
			return createGeometry({ case: 'sphere', value: { radiusMm: r } })
		}
		// RDK's own spelling of "no geometry", and what inference returns when no
		// dimension was set either.
		case '': {
			return undefined
		}
		default: {
			// `cylinder`, `point` and `mesh` have no `common.v1.Geometry` case —
			// rdk's `Cylinder.ToProtobuf` panics rather than pick a stand-in.
			console.warn(`[frame] geometry type "${raw.type as string}" cannot be drawn — skipping it`)
			return undefined
		}
	}
}

export const createGeometryFromFrame = (frame: Partial<Frame>): RDKGeometry | undefined => {
	const geometry = frame.geometry
	if (!geometry) {
		return undefined
	}

	switch (geometry.type) {
		case 'none': {
			return undefined
		}
		case 'box': {
			return createGeometry({
				case: 'box',
				value: {
					dimsMm: {
						x: geometry.x,
						y: geometry.y,
						z: geometry.z,
					},
				},
			})
		}
		case 'sphere': {
			return createGeometry({
				case: 'sphere',
				value: {
					radiusMm: geometry.r,
				},
			})
		}
		case 'capsule': {
			return createGeometry({
				case: 'capsule',
				value: {
					radiusMm: geometry.r,
					lengthMm: geometry.l,
				},
			})
		}
		default: {
			// The assignment catches a shape added to the union without a case here.
			// The call handles what the union does not bound: a config is authored
			// against rdk, so a `GeometryConfig` is what arrives.
			const _exhaustive: never = geometry
			return createGeometryFromRdkConfig(_exhaustive)
		}
	}
}

export const createBox = (box?: RectangularPrism) => {
	return {
		x: box?.dimsMm?.x ?? 0,
		y: box?.dimsMm?.y ?? 0,
		z: box?.dimsMm?.z ?? 0,
	}
}

export const createCapsule = (capsule?: Capsule) => {
	return {
		r: capsule?.radiusMm ?? 0,
		l: capsule?.lengthMm ?? 0,
	}
}

export const createSphere = (sphere?: Sphere) => {
	return {
		r: sphere?.radiusMm ?? 0,
	}
}

export const createCylinder = (cylinder?: Cylinder) => {
	return {
		r: cylinder?.radiusMm ?? 0,
		l: cylinder?.lengthMm ?? 0,
		capped: cylinder?.capped ?? true,
	}
}

export const isPointCloud = (
	geometry?: Geometry['geometryType']
): geometry is { case: 'pointcloud'; value: PointCloud } => {
	return geometry?.case === 'pointcloud'
}

/**
 * Reverse of {@link createGeometryFromFrame}: reads a Transform's geometry back into
 * the frame geometry shape. Anything a frame cannot express, which is every case
 * beyond box, sphere and capsule, resolves to undefined.
 */
export const frameGeometryFromTransform = (transform: Transform): Frame['geometry'] => {
	const geometryType = transform.physicalObject?.geometryType
	switch (geometryType?.case) {
		case 'box': {
			return { type: 'box', ...createBox(geometryType.value) }
		}
		case 'sphere': {
			return { type: 'sphere', ...createSphere(geometryType.value) }
		}
		case 'capsule': {
			return { type: 'capsule', ...createCapsule(geometryType.value) }
		}
		default: {
			return undefined
		}
	}
}
