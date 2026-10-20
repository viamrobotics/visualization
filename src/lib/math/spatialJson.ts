/**
 * The entry point for reading rdk's `spatialmath` JSON: geometry offsets here,
 * orientation and shape decoding re-exported. Shared by the config, motion plan
 * and kinematics readers so none can drift.
 */

import { Quaternion, Vector3 } from 'three'

import { quatFromJson, type RawOrientation } from './orientationJson'
import { Pose } from './pose'

export { inferGeometryType, type RawGeometryJson } from './geometryJson'
export { quatFromJson, type RawOrientation } from './orientationJson'

/** Go marshals untagged `r3.Vector` fields under their exported names. */
export type Vec3Json = { X: number; Y: number; Z: number }

export type FramePoseJson = { translation?: Vec3Json; orientation?: RawOrientation }

const tmpQ = new Quaternion()
const tmpQFrame = new Quaternion()
const tmpQGeo = new Quaternion()
const tmpQInv = new Quaternion()
const tmpQLocal = new Quaternion()
const tmpV = new Vector3()

/** A frame's own local pose: capitalised translation plus an orientation config. */
export const poseFromJson = (
	translation: Vec3Json | undefined,
	orientation: RawOrientation | undefined
): Pose => {
	quatFromJson(orientation, tmpQ)
	return new Pose(translation?.X ?? 0, translation?.Y ?? 0, translation?.Z ?? 0).setFromQuaternion(
		tmpQ
	)
}

/**
 * A model link's geometry offset is measured from the link's *parent*, sibling to the link's own
 * pose — but the renderer attaches geometry to the link and reads the center as link-local.
 * Passing it through unchanged doubles every offset, so the frame's own pose has to be undone:
 * `P_frame⁻¹ ∘ P_geometry`.
 *
 * This is RDK's convention, not a workaround. `FrameSystem.Transform` skips the final transform
 * when the subject is a `GeometriesInFrame`, explaining itself in `referenceframe/frame_system.go`:
 * "A frame is assigned a pose and a geometry and the two are not coupled together. This way you can
 * define everything relative to the parent frame."
 *
 * Only for frames carrying a model link's geometry. An obstacle's center is already local, and the
 * JSON looks identical either way — only the frame's kind says which convention applies.
 */
export const geometryCenterInFrame = (
	geoTrans: Vec3Json | undefined,
	geoOrient: RawOrientation | undefined,
	framePose: FramePoseJson
): Pose => {
	quatFromJson(framePose.orientation, tmpQFrame)
	tmpQInv.copy(tmpQFrame).invert()

	tmpV
		.set(
			(geoTrans?.X ?? 0) - (framePose.translation?.X ?? 0),
			(geoTrans?.Y ?? 0) - (framePose.translation?.Y ?? 0),
			(geoTrans?.Z ?? 0) - (framePose.translation?.Z ?? 0)
		)
		.applyQuaternion(tmpQInv)

	const center = new Pose(tmpV.x, tmpV.y, tmpV.z)

	// Unconditional: an absent orientation means identity in the parent's frame, which is still
	// R_frame⁻¹ once expressed locally. `quatFromJson` writes identity when it finds nothing.
	quatFromJson(geoOrient, tmpQGeo)
	tmpQLocal.copy(tmpQInv).multiply(tmpQGeo)
	center.setFromQuaternion(tmpQLocal)

	return center
}
