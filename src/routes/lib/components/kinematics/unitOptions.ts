import { CollisionShape, LengthUnit } from '$lib/buf/kinematics/v1/spec_pb'

export const UNIT_LABELS: Partial<Record<LengthUnit, string>> = {
	[LengthUnit.METERS]: 'm',
	[LengthUnit.MILLIMETERS]: 'mm',
	[LengthUnit.INCHES]: 'in',
}

export const UNITS = [LengthUnit.METERS, LengthUnit.MILLIMETERS, LengthUnit.INCHES] as const

export const SHAPE_LABELS: Partial<Record<CollisionShape, string>> = {
	[CollisionShape.MESH]: 'mesh',
	[CollisionShape.BOX]: 'box',
}

export const SHAPES = [CollisionShape.MESH, CollisionShape.BOX] as const
