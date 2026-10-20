import type { PlainMessage } from '@bufbuild/protobuf'

import type { Vector3 } from '$lib/buf/common/v1/common_pb'

const format = (value: number): string => String(Math.round(value * 10) / 10)

/** An extent in millimetres as `x × y × z mm`, to one decimal place. */
export const formatExtent = (extent: PlainMessage<Vector3> | undefined): string =>
	extent ? `${format(extent.x)} × ${format(extent.y)} × ${format(extent.z)} mm` : '-'

/** A byte count as kB below 1 MB and MB above. */
export const formatBytes = (bytes: number): string =>
	bytes >= 1_000_000 ? `${format(bytes / 1_000_000)} MB` : `${format(bytes / 1000)} kB`
