import type { PlainMessage } from '@bufbuild/protobuf'
import type { cameraApi } from '@viamrobotics/sdk'

import { MathUtils } from 'three'

/**
 * A camera's pinhole intrinsics, as `GetProperties` reports them.
 *
 * The fields of `IntrinsicParameters` without the `Message` methods, so a reply satisfies
 * it and a test can write one as a literal.
 */
export type Intrinsics = PlainMessage<cameraApi.IntrinsicParameters>

/**
 * Whether these intrinsics describe a real pinhole camera.
 *
 * A camera that reports the message but not the values leaves them zero, which would
 * otherwise unproject to a degenerate or wildly skewed volume. Requiring the principal
 * point to fall inside the image rejects that without rejecting any real camera.
 */
export const isUsableIntrinsics = (intrinsics: Intrinsics): boolean => {
	const { widthPx, heightPx, focalXPx, focalYPx, centerXPx, centerYPx } = intrinsics

	return (
		widthPx > 0 &&
		heightPx > 0 &&
		focalXPx > 0 &&
		focalYPx > 0 &&
		Number.isFinite(widthPx) &&
		Number.isFinite(heightPx) &&
		Number.isFinite(focalXPx) &&
		Number.isFinite(focalYPx) &&
		centerXPx > 0 &&
		centerXPx < widthPx &&
		centerYPx > 0 &&
		centerYPx < heightPx
	)
}

/**
 * The full vertical field of view, in degrees, for a principal point at the image center.
 * An off-center principal point makes the view asymmetric, which one angle cannot describe.
 */
export const verticalFovDegrees = (intrinsics: Intrinsics): number =>
	MathUtils.radToDeg(2 * Math.atan(intrinsics.heightPx / (2 * intrinsics.focalYPx)))
