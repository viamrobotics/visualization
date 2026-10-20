import type { PlainMessage } from '@bufbuild/protobuf'

import type { Vector3 } from '$lib/buf/common/v1/common_pb'

import { LengthUnit } from '$lib/buf/kinematics/v1/spec_pb'

/**
 * Suggests a different mesh unit when a link's built extent is implausible for the unit chosen:
 * larger than 10 m usually means a millimetre file read as metres, and smaller than 1 mm usually
 * means a metre file read as millimetres.
 *
 * @param extent The link's extent in millimetres from the validation report.
 * @returns The unit to suggest, or `undefined` when the current one looks right.
 */
export const unitHint = (
	extent: PlainMessage<Vector3> | undefined,
	unit: LengthUnit
): LengthUnit | undefined => {
	if (!extent) return undefined
	const largest = Math.max(extent.x, extent.y, extent.z)
	if (unit === LengthUnit.METERS && largest > 10_000) return LengthUnit.MILLIMETERS
	if (unit === LengthUnit.MILLIMETERS && largest < 1) return LengthUnit.METERS
	return undefined
}
