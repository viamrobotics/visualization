import type { Pose } from '$lib/math'

import { type Geometry } from '$lib/geometry'
import {
	type FramePoseJson,
	geometryCenterInFrame,
	poseFromJson,
	type RawOrientation,
	type Vec3Json,
} from '$lib/math/spatialJson'

/**
 * Both are rdk's `spatialmath` JSON shapes, aliased here so a reader of the
 * kinematics types does not have to jump files to learn that a translation is
 * capitalised and an orientation is a tagged union.
 */
export type RawKinematicsTranslation = Vec3Json
export type RawKinematicsOrientation = RawOrientation

export interface RawKinematicsGeometry {
	x?: number
	y?: number
	z?: number
	r?: number
	l?: number
	/** Cylinders only: false is an open tube. rdk omits the field for solid ones. */
	capped?: boolean
	type?: string
	Label?: string
	translation?: RawKinematicsTranslation
	orientation?: RawKinematicsOrientation
	mesh_data?: string | number[]
	mesh_content_type?: string
	mesh_file_path?: string
}

export interface RawKinematicsLink {
	id: string
	parent?: string
	translation?: RawKinematicsTranslation
	orientation?: RawKinematicsOrientation
	geometry?: RawKinematicsGeometry
}

export interface RawKinematicsJoint {
	id: string
	parent?: string
}

/**
 * rdk's `ModelConfigJSON`, as it arrives in `FrameSystemConfig.kinematics`.
 *
 * `FrameSystemPart.ToProtobuf` fills `kinematics` from the model's
 * `modelConfig` — the parse *input*, not the resolved model — so the fields
 * here are the ones `UnmarshalModelJSON` reads and nothing rdk derived
 * afterwards. In particular there is no `primary_output_frame`; that lives on
 * the serialised model a motion plan carries.
 */
export interface RawKinematicsModel {
	name?: string
	/** `"SVA"` or absent for link/joint models; `"DH"` for Denavit–Hartenberg. */
	kinematic_param_type?: string
	links?: RawKinematicsLink[]
	joints?: RawKinematicsJoint[]
	/** Only set on `"DH"` models, where `links` and `joints` are both empty. */
	dhParams?: unknown[]
	/** rdk accepts at most one entry and errors on more. */
	output_frames?: string[]
}

/**
 * Whether rdk built this model from `dhParams` rather than `links`/`joints`.
 *
 * Such a model carries no links, so frame derivation yields nothing at all —
 * worth reporting rather than rendering an empty component.
 */
export const isDHModel = (model: RawKinematicsModel): boolean =>
	model.kinematic_param_type === 'DH' ||
	((model.links ?? []).length === 0 && (model.dhParams ?? []).length > 0)

/**
 * `mesh_data` arrives either base64-encoded (Go's `[]byte` -> JSON string) or
 * as a raw byte array, depending on how the kinematics Struct was encoded.
 */
const toMeshBytes = (data?: string | number[]): Uint8Array => {
	if (data === undefined) {
		return new Uint8Array(0)
	}

	if (typeof data === 'string') {
		const binary = atob(data)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i)
		}
		return bytes
	}

	return Uint8Array.from(data)
}

/**
 * Convert a raw kinematics link geometry JSON blob into the {@link Geometry}
 * shape expected by the ECS trait system.
 *
 * Raw format (from `kinematics.links[].geometry`):
 *   `{ x, y, z, r, l, capped, type, Label, translation: { X, Y, Z }, orientation }`
 *
 * Target format:
 *   `{ geometryType: { case, value }, label, center: Pose }`
 *
 * `type` is authoritative; when it is absent rdk infers the shape from whichever
 * params are set, and so do we.
 *
 * Pass `linkPose` — the owning link's own translation/orientation — for a link
 * geometry, whose offset is measured from the link's parent rather than from the
 * link (see `geometryCenterInFrame`). Omit it only for a geometry that is
 * already frame-local.
 */
export const parseKinematicsGeometry = (
	raw: RawKinematicsGeometry,
	linkPose?: FramePoseJson
): Geometry => {
	const center: Pose = linkPose
		? geometryCenterInFrame(raw.translation, raw.orientation, linkPose)
		: poseFromJson(raw.translation, raw.orientation)
	const label = raw.Label ?? ''

	const box = (): Geometry => ({
		center,
		label,
		geometryType: {
			case: 'box',
			value: { dimsMm: { x: raw.x ?? 0, y: raw.y ?? 0, z: raw.z ?? 0 } },
		},
	})

	const sphere = (): Geometry => ({
		center,
		label,
		geometryType: { case: 'sphere', value: { radiusMm: raw.r ?? 0 } },
	})

	const capsule = (): Geometry => ({
		center,
		label,
		geometryType: { case: 'capsule', value: { radiusMm: raw.r ?? 0, lengthMm: raw.l ?? 0 } },
	})

	// `capped` defaults to true because rdk omits the field for a solid cylinder
	// and writes it only to mark an open tube (`spatialmath/geometry.go`).
	const cylinder = (): Geometry => ({
		center,
		label,
		geometryType: {
			case: 'cylinder',
			value: { radiusMm: raw.r ?? 0, lengthMm: raw.l ?? 0, capped: raw.capped ?? true },
		},
	})

	const mesh = (): Geometry => ({
		center,
		label,
		geometryType: {
			case: 'mesh',
			value: { contentType: raw.mesh_content_type ?? '', mesh: toMeshBytes(raw.mesh_data) },
		},
	})

	const none = (): Geometry => ({
		center,
		label,
		geometryType: { case: undefined, value: undefined },
	})

	switch (raw.type) {
		case 'box': {
			return box()
		}
		case 'sphere': {
			return sphere()
		}
		case 'capsule': {
			return capsule()
		}
		case 'cylinder': {
			return cylinder()
		}
		case 'mesh': {
			if (raw.mesh_data === undefined || raw.mesh_data.length === 0) {
				// URDF meshes referenced only by path aren't inlined into the
				// kinematics, so there is nothing to render.
				console.warn(
					`[kinematics] mesh geometry "${label}" has no mesh_data${
						raw.mesh_file_path ? ` (file path: ${raw.mesh_file_path})` : ''
					}`
				)
				return none()
			}
			return mesh()
		}
		case undefined:
		case '': {
			// rdk infers intent from whichever params are set when `type` is
			// omitted — mirror `GeometryConfig.ParseConfig`'s order exactly.
			if ((raw.x ?? 0) !== 0 || (raw.y ?? 0) !== 0 || (raw.z ?? 0) !== 0) {
				return box()
			}
			if ((raw.l ?? 0) !== 0) {
				return capsule()
			}
			if ((raw.r ?? 0) !== 0) {
				return sphere()
			}
			return none()
		}
		default: {
			// `point` has no equivalent in the geometry union.
			return none()
		}
	}
}
