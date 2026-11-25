import { commonApi, type robotApi } from '@viamrobotics/sdk'
import { MathUtils } from 'three'

import type {
	RawKinematicsGeometry,
	RawKinematicsJoint,
	RawKinematicsLink,
	RawKinematicsModel,
	RawKinematicsOrientation,
} from './kinematicsTransform'

/**
 * A hand port of rdk's `orientationFromProto` plus `spatialmath.NewOrientationConfig`, in
 * `referenceframe/model_proto.go`. Euler and axis angles arrive in degrees and are written in
 * radians, as rdk's `EulerAngles` and `R4AA` marshal them.
 */
const orientationJson = (pose: commonApi.LinkPose): RawKinematicsOrientation | undefined => {
	const { orientation } = pose

	switch (orientation.case) {
		case 'quaternion': {
			const { w, x, y, z } = orientation.value
			return { type: 'quaternion', value: { W: w, X: x, Y: y, Z: z } }
		}
		case 'orientationVector': {
			const { oX, oY, oZ, theta } = orientation.value
			return { type: 'ov_degrees', value: { x: oX, y: oY, z: oZ, th: theta } }
		}
		case 'eulerAngles': {
			const { roll, pitch, yaw } = orientation.value
			return {
				type: 'euler_angles',
				value: {
					roll: MathUtils.degToRad(roll),
					pitch: MathUtils.degToRad(pitch),
					yaw: MathUtils.degToRad(yaw),
				},
			}
		}
		case 'axisAngles': {
			const { rx, ry, rz, theta } = orientation.value
			return {
				type: 'axis_angles',
				value: { x: rx, y: ry, z: rz, th: MathUtils.degToRad(theta) },
			}
		}
		case undefined: {
			return undefined
		}
		default: {
			const unhandled: never = orientation
			return unhandled
		}
	}
}

/**
 * A hand port of rdk's `geometryConfigFromProto`, in `referenceframe/model_proto.go`. rdk leaves
 * an identity offset orientation out, so a geometry written without one round-trips unchanged.
 * A geometry rdk cannot carry in a model config, such as a point cloud, is dropped here, where
 * rdk would refuse the whole model.
 */
const geometryJson = (geometry: commonApi.Geometry): RawKinematicsGeometry | undefined => {
	const json: RawKinematicsGeometry = { Label: geometry.label }

	const { center } = geometry
	if (center) {
		json.translation = { X: center.x, Y: center.y, Z: center.z }

		const isIdentity = center.oX === 0 && center.oY === 0 && center.oZ >= 0 && center.theta === 0
		if (!isIdentity) {
			json.orientation = {
				type: 'ov_degrees',
				value: { x: center.oX, y: center.oY, z: center.oZ, th: center.theta },
			}
		}
	}

	const { geometryType } = geometry
	switch (geometryType.case) {
		case 'box': {
			const dims = geometryType.value.dimsMm
			return { ...json, type: 'box', x: dims?.x ?? 0, y: dims?.y ?? 0, z: dims?.z ?? 0 }
		}
		case 'sphere': {
			return { ...json, type: 'sphere', r: geometryType.value.radiusMm }
		}
		case 'capsule': {
			return {
				...json,
				type: 'capsule',
				r: geometryType.value.radiusMm,
				l: geometryType.value.lengthMm,
			}
		}
		case 'mesh': {
			return {
				...json,
				type: 'mesh',
				mesh_data: [...geometryType.value.mesh],
				mesh_content_type: geometryType.value.contentType,
				mesh_file_path: geometryType.value.originalFileSourcePathDiagnostic,
			}
		}
		default: {
			return undefined
		}
	}
}

/** A hand port of rdk's `linkConfigFromProto` and `LinkConfig.setGeometryConfigs`. */
const linkJson = (link: commonApi.KinematicLink): RawKinematicsLink => {
	// `parent,omitempty` on rdk's `LinkConfig`.
	const json: RawKinematicsLink = { id: link.id, ...(link.parent ? { parent: link.parent } : {}) }

	if (link.pose) {
		const translation = link.pose.translation
		json.translation = { X: translation?.x ?? 0, Y: translation?.y ?? 0, Z: translation?.z ?? 0 }

		const orientation = orientationJson(link.pose)
		if (orientation) json.orientation = orientation
	}

	const [first, ...rest] = link.collision.flatMap((geometry) => {
		const converted = geometryJson(geometry)
		return converted ? [converted] : []
	})
	if (first) json.geometry = first
	if (rest.length > 0) json.geometries = rest

	return json
}

/**
 * rdk's `JointConfig.Type` strings. rdk writes a continuous joint as a revolute one with no limits,
 * which is how its URDF reader has always represented one.
 */
const JOINT_TYPE_NAMES: Partial<Record<commonApi.JointType, string>> = {
	[commonApi.JointType.REVOLUTE]: 'revolute',
	[commonApi.JointType.CONTINUOUS]: 'revolute',
	[commonApi.JointType.PRISMATIC]: 'prismatic',
}

/**
 * A hand port of rdk's `jointConfigFromProto`. rdk writes an absent limit as an infinite one, which
 * JSON cannot carry, so it is left out here and reads as unbounded. An unspecified joint type, which
 * rdk refuses, is written as an empty type, so the readers downstream refuse it too.
 */
const jointJson = (joint: commonApi.KinematicJoint): RawKinematicsJoint => {
	const json: RawKinematicsJoint = {
		id: joint.id,
		parent: joint.parent,
		type: JOINT_TYPE_NAMES[joint.type] ?? '',
		axis: { X: joint.axis?.x ?? 0, Y: joint.axis?.y ?? 0, Z: joint.axis?.z ?? 0 },
	}

	if (joint.mimic) {
		json.mimic = {
			joint: joint.mimic.joint,
			multiplier: joint.mimic.multiplier,
			offset: joint.mimic.offset,
		}
	} else if (joint.limits) {
		const { min, max, maxVelocity, maxAcceleration } = joint.limits
		if (min !== undefined) json.min = min
		if (max !== undefined) json.max = max
		if (maxVelocity !== undefined) json.max_velocity = maxVelocity
		if (maxAcceleration !== undefined) json.max_acceleration = maxAcceleration
	}

	if (joint.geometry) {
		const geometry = geometryJson(joint.geometry)
		if (geometry) json.geometry = geometry
	}

	return json
}

/**
 * The typed `KinematicModel` written out as rdk's `ModelConfigJSON`: a hand port of rdk's
 * `modelConfigFromProto`, in `referenceframe/model_proto.go`. rdk has already expanded DH
 * parameters and converted URDF into links and joints before sending it, so the result is always
 * an SVA model. Visual geometry has no place in the config and is left out, as rdk leaves it out.
 */
export const kinematicModelToJson = (model: commonApi.KinematicModel): RawKinematicsModel => ({
	name: model.name,
	kinematic_param_type: 'SVA',
	links: model.links.map((link) => linkJson(link)),
	joints: model.joints.map((joint) => jointJson(joint)),
	...(model.outputFrames.length > 0 ? { output_frames: model.outputFrames } : {}),
})

/**
 * A frame system part's kinematics as rdk's `ModelConfigJSON`, or undefined when the part has none.
 *
 * Prefers the typed `model`, which carries DH and URDF arms as links and joints. Falls back to the
 * deprecated `kinematics` struct for a server that predates `model`, where a DH arm still arrives
 * as `dhParams`.
 */
export const partKinematicsJson = (
	part: robotApi.FrameSystemConfig
): RawKinematicsModel | undefined => {
	if (part.model) return kinematicModelToJson(part.model)

	const { kinematics } = part
	if (kinematics === undefined || Object.keys(kinematics.fields).length === 0) return undefined

	return kinematics.toJson() as RawKinematicsModel
}
