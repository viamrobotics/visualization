import { Color } from 'three'

import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'

export const STRIDE = {
	/** Arrows: [x, y, z, ox, oy, oz, ...] */
	ARROWS: 6,
	/** Line/Points: [x, y, z, ...] */
	POSITIONS: 3,
	/** Nurbs control points: [x, y, z, ox, oy, oz, theta, ...] */
	NURBS_CONTROL_POINTS: 7,
	/** Nurbs knots/weights: [w, ...] */
	NURBS_KNOTS: 1,
	/** Colors: [r, g, b, ...] */
	COLORS_RGB: 3,
} as const

/**
 * Creates a Float32Array view over a Uint8Array without copying data.
 * Falls back to a copy if the buffer is not 4-byte aligned (rare with protobuf).
 *
 * An optional `transform` applies a per-element function during conversion.
 *
 * @param bytes - The raw bytes from a protobuf bytes field
 * @param transform - Optional function applied to every float element
 * @returns A Float32Array view or copy of the data
 *
 * @example
 * ```ts
 * const positions = asFloat32Array(line.positions)
 * const meterPositions = asFloat32Array(line.positions, inMeters)
 * ```
 */
export const asFloat32Array = (
	bytes: Uint8Array,
	transform?: (value: number) => number
): Float32Array => {
	if (bytes.length === 0) {
		return new Float32Array(0)
	}

	if (bytes.byteOffset % 4 === 0 && bytes.byteLength % 4 === 0) {
		const view = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
		if (transform) {
			for (let i = 0; i < view.length; i++) view[i] = transform(view[i])
		}
		return view
	}

	const aligned = new Float32Array(bytes.byteLength / 4)
	const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (transform) {
		for (let i = 0; i < aligned.length; i++) {
			aligned[i] = transform(dataView.getFloat32(i * 4, true))
		}
	} else {
		for (let i = 0; i < aligned.length; i++) {
			aligned[i] = dataView.getFloat32(i * 4, true)
		}
	}
	return aligned
}

/**
 * Sets a Three.js Color from 3 bytes of a uint8 RGB color array starting at `offset`.
 * Mutates and returns `target` — pass a pre-allocated Color to avoid allocations
 * in hot paths.
 *
 * @param bytes - Uint8Array with at least `offset + 3` elements [r, g, b, ...]
 * @param target - Color instance to write into
 * @param offset - Byte offset to start reading from (default 0)
 * @returns The mutated `target`, or black if the array has fewer than `offset + 3` elements
 *
 * @example
 * ```ts
 * asColor(colors.current, material.color)
 * asColor(colors.current, pointColorUtil, STRIDE.COLORS_RGB) // read second color
 * ```
 */
export const asColor = (bytes: Uint8Array, target: Color, offset = 0): Color => {
	if (bytes.length < offset + 3) return target.setRGB(0, 0, 0)
	return target.setRGB(bytes[offset] / 255, bytes[offset + 1] / 255, bytes[offset + 2] / 255)
}

export const asRGB = (
	bytes: Uint8Array,
	target: { r: number; g: number; b: number },
	offset = 0
): { r: number; g: number; b: number } => {
	target.r = (bytes[offset] ?? 0) / 255
	target.g = (bytes[offset + 1] ?? 0) / 255
	target.b = (bytes[offset + 2] ?? 0) / 255
	return target
}

/**
 * Reads a byte from a uint8 opacities array at `index` and normalizes it to 0-1.
 * Returns `fallback` when the array is absent or shorter than `index + 1`.
 *
 * @param opacities - Uint8Array of opacity values (0-255). Length 1 = uniform. Length N = per-vertex.
 * @param fallback - Value to return when no opacity byte is available (default 1)
 * @param index - Index into the opacities array (default 0)
 * @returns Normalized opacity in 0-1 range, or the fallback value
 *
 * @example
 * ```ts
 * material.opacity = asOpacity(metadata.opacities)
 * ```
 */
export const asOpacity = (opacities: Uint8Array | undefined, fallback = 1, index = 0): number => {
	if (!opacities || opacities.length === 0) return fallback
	// If only one opacity byte, it is the uniform opacity regardless of index
	const i = opacities.length === 1 ? 0 : index
	if (opacities.length <= i) return fallback
	return opacities[i] / 255
}

/**
 * Returns true when `colors` contains exactly one color (RGB or RGBA),
 * as opposed to a per-vertex color array.
 *
 * @example
 * ```ts
 * if (isSingleColor(colors)) {
 *   material.color = asColor(colors, colorUtil)
 * }
 * ```
 */
export const isSingleColor = (colors: Uint8Array): boolean => {
	if (!colors) return false
	return colors.length === STRIDE.COLORS_RGB
}

/**
 * Returns true when `colors` contains per-vertex color data rather than a
 * single uniform color.
 *
 * @param colors - Uint8Array of packed RGB bytes (stride of 3)
 *
 * @example
 * ```ts
 * if (isVertexColors(colors, positions.length / 3)) {
 *   // treat as per-vertex
 * }
 * ```
 */
export const isVertexColors = (colors: Uint8Array | undefined): colors is Uint8Array => {
	if (!colors || colors.length === 0) return false
	if (isSingleColor(colors)) return false
	return colors.length % STRIDE.COLORS_RGB === 0
}

/**
 * Per-element transform that converts a millimeter value to meters.
 * Pass to {@link asFloat32Array} to fuse the conversion into a single pass.
 *
 * @example
 * ```ts
 * const positions = asFloat32Array(line.positions, inMeters)
 * ```
 */
export const inMeters = (v: number): number => v * 0.001

/** Returns the byte stride for a given color format. */
export const colorStride = (format?: ColorFormat): number => {
	switch (format) {
		case ColorFormat.RGB: {
			return STRIDE.COLORS_RGB
		}
		default: {
			return 0
		}
	}
}
