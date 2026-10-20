import type { PartialMessage } from '@bufbuild/protobuf'

import { type JsonValue, Struct } from '@viamrobotics/sdk'

import type { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'

import { Geometry, Transform } from '$lib/buf/common/v1/common_pb'
import { Drawing, Shape } from '$lib/buf/draw/v1/drawing_pb'
import { Metadata } from '$lib/buf/draw/v1/metadata_pb'
import { Pose } from '$lib/math'

/** Which `draw.ts` entry point renders a draft: `Transform` or `Drawing`. */
export type EntityKind = 'transform' | 'drawing'

export interface DraftPose {
	x: number
	y: number
	z: number
	oX?: number
	oY?: number
	oZ?: number
	theta?: number
}

export interface DraftMetadata {
	colors?: Uint8Array
	opacities?: Uint8Array
	colorFormat?: ColorFormat
	showAxesHelper?: boolean
	invisible?: boolean
}

/**
 * Wire-agnostic description of a single entity. `toTransform` and `toDrawing`
 * render it into the proto its entry point expects, so a spawn payload and the
 * update payload it is compared against are built from one source.
 */
export interface EntityDraft {
	name: string
	kind: EntityKind
	uuid: number
	parent?: string
	pose: DraftPose
	center?: DraftPose
	/** `common.v1.Geometry` oneof, for `transform` drafts. */
	geometry?: PartialMessage<Geometry>['geometryType']
	/** `draw.v1.Shape` oneof, for `drawing` drafts. */
	shape?: PartialMessage<Shape>['geometryType']
	metadata: DraftMetadata
}

const uuidBytes = (value: number): Uint8Array<ArrayBuffer> => {
	const bytes = new Uint8Array(16)
	bytes[15] = value
	return bytes
}

const toPose = ({ x, y, z, oX, oY, oZ, theta }: DraftPose): Pose =>
	new Pose(x, y, z, oX, oY, oZ, theta)

const toBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary)
}

/**
 * A `Transform` carries metadata as a `google.protobuf.Struct`, which has no
 * binary type, so `metadataFromStruct` base64-decodes `colors` and `opacities`.
 * A `Drawing` carries the typed `Metadata` message and takes the raw bytes.
 */
const toMetadataStruct = (metadata: DraftMetadata): Struct => {
	const fields: Record<string, JsonValue> = {}

	if (metadata.colors) fields.colors = toBase64(metadata.colors)
	if (metadata.opacities) fields.opacities = toBase64(metadata.opacities)
	if (metadata.colorFormat !== undefined) fields.color_format = metadata.colorFormat
	if (metadata.showAxesHelper !== undefined) fields.show_axes_helper = metadata.showAxesHelper
	if (metadata.invisible !== undefined) fields.invisible = metadata.invisible

	return Struct.fromJson(fields)
}

export const toTransform = (draft: EntityDraft): Transform =>
	new Transform({
		referenceFrame: draft.name,
		uuid: uuidBytes(draft.uuid),
		poseInObserverFrame: {
			referenceFrame: draft.parent ?? '',
			pose: toPose(draft.pose),
		},
		physicalObject: draft.geometry
			? new Geometry({
					geometryType: draft.geometry,
					center: draft.center ? toPose(draft.center) : undefined,
				})
			: undefined,
		metadata: toMetadataStruct(draft.metadata),
	})

export const toDrawing = (draft: EntityDraft): Drawing =>
	new Drawing({
		referenceFrame: draft.name,
		uuid: uuidBytes(draft.uuid),
		poseInObserverFrame: {
			referenceFrame: draft.parent ?? '',
			pose: toPose(draft.pose),
		},
		// A Shape carrying only a center is what drives `applyShape`'s default
		// branch: a legal Drawing whose geometry oneof is unset.
		physicalObject:
			draft.shape || draft.center
				? new Shape({
						geometryType: draft.shape ?? { case: undefined },
						center: draft.center ? toPose(draft.center) : undefined,
					})
				: undefined,
		metadata: new Metadata({
			colors: draft.metadata.colors,
			opacities: draft.metadata.opacities,
			colorFormat: draft.metadata.colorFormat,
			showAxesHelper: draft.metadata.showAxesHelper,
			invisible: draft.metadata.invisible,
		}),
	})

/** Packs float32 values into the little-endian byte layout the protos use. */
export const packFloats = (...values: number[]): Uint8Array<ArrayBuffer> =>
	new Uint8Array(new Float32Array(values).buffer as ArrayBuffer)
