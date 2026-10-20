import { JointType } from '$lib/buf/kinematics/v1/spec_pb'

const DEGREES_PER_RADIAN = 180 / Math.PI

/** A revolute input shows in degrees and a prismatic one in mm, which is already its RDK unit. */
export const toDisplayUnits = (type: JointType, value: number): number =>
	type === JointType.REVOLUTE ? value * DEGREES_PER_RADIAN : value

/** The RDK input value (mm or radians) for a slider value in display units. */
export const fromDisplayUnits = (type: JointType, value: number): number =>
	type === JointType.REVOLUTE ? value / DEGREES_PER_RADIAN : value

export const unitSuffix = (type: JointType): string => (type === JointType.REVOLUTE ? 'deg' : 'mm')
