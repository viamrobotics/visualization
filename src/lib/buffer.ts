/**
 * Zero-copy buffer utilities for converting protobuf bytes to Three.js typed arrays.
 *
 * Proto messages pack float32 data as `Uint8Array` (bytes fields). These utilities
 * provide efficient conversion to `Float32Array` for Three.js BufferAttributes.
 */
import { Color } from 'three'

/**
 * Stride constants for proto binary data formats.
 * Each value represents the number of float32 elements per item.
 */
export const STRIDE = {
	/** Arrows: [x, y, z, ox, oy, oz] per arrow */
	ARROWS: 6,
	/** Line/Points: [x, y, z] per point */
	POSITIONS: 3,
	/** Nurbs control points: [x, y, z, ox, oy, oz, theta] per point */
	NURBS_CONTROL_POINTS: 7,
	/** Nurbs knots/weights: single float per element */
	NURBS_KNOTS: 1,
	/** Colors: [r, g, b, a] per color (uint8) */
	COLORS_RGBA: 4,
	/** Colors: [r, g, b] */
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
 * const metrePositions = asFloat32Array(line.positions, inMetres)
 * ```
 */
export const asFloat32Array = (
	bytes: Uint8Array<ArrayBuffer>,
	transform?: (value: number) => number
): Float32Array<ArrayBuffer> => {
	if (bytes.length === 0) {
		return new Float32Array(0)
	}

	if (bytes.byteOffset % 4 === 0 && bytes.byteLength % 4 === 0) {
		const view = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
		if (transform) {
			for (let i = 0; i < view.length; i++) view[i] = transform(view[i]!)
		}
		return view
	}

	const aligned = new Float32Array(bytes.byteLength / 4)
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (transform) {
		for (let i = 0; i < aligned.length; i++) {
			aligned[i] = transform(dv.getFloat32(i * 4, true))
		}
	} else {
		for (let i = 0; i < aligned.length; i++) {
			aligned[i] = dv.getFloat32(i * 4, true)
		}
	}
	return aligned
}

/**
 * Sets a Three.js Color from 3 bytes of a uint8 color array starting at `offset`.
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
 * asColor(colors.current, pointColorUtil, stride) // read second color
 * ```
 */
export const asColor = (bytes: Uint8Array<ArrayBuffer>, target: Color, offset = 0): Color => {
	if (bytes.length < offset + 3) return target.setRGB(0, 0, 0)
	return target.setRGB(bytes[offset]! / 255, bytes[offset + 1]! / 255, bytes[offset + 2]! / 255)
}

/**
 * Creates a Uint8Array from a Three.js Color.
 *
 * @param color - The Three.js Color to convert
 * @returns A Uint8Array with the RGBA values
 *
 * @example
 * ```ts
 * const color = fromColor(new Color(0, 1, 0))
 * ```
 */
export const fromColor = (color: Color): Uint8Array<ArrayBuffer> => {
	return new Uint8Array([
		Math.round(color.r * 255),
		Math.round(color.g * 255),
		Math.round(color.b * 255),
	])
}

/**
 * Reads a byte from a uint8 color array at `offset` and normalizes it to 0-1.
 * Returns `fallback` when the array has fewer than `offset + 1` elements.
 *
 * @param bytes - ArrayLike of uint8 color values
 * @param fallback - Value to return when no alpha byte is present (default 1)
 * @param offset - Byte index to read from (default 3, the alpha channel of the first color)
 * @returns Normalized opacity in 0-1 range, or the fallback value
 *
 * @example
 * ```ts
 * material.opacity = asOpacity(colors.current)
 * material.opacity = asOpacity(colors.current, 1, stride + 3) // alpha of second color
 * ```
 */
export const asOpacity = (bytes: Uint8Array<ArrayBuffer>, fallback = 1, offset = 3): number => {
	if (bytes.length < offset + 1) return fallback
	return bytes[offset]! / 255
}

/**
 * Returns true when `colors` contains exactly one color entry per point (RGB or RGBA).
 * Use this to distinguish per-vertex color buffers from a single uniform color.
 *
 * @param colors - Uint8Array of packed color bytes
 * @param numVertex - Number of points/vertices the color buffer should cover
 *
 * @example
 * ```ts
 * if (isPerVertexColors(colors, positions.length / STRIDE.POSITIONS)) {
 *   // treat as per-vertex
 * } else {
 *   addColorTraits(entityTraits, colors)
 * }
 * ```
 */
export const isVertexColors = (colors: Uint8Array<ArrayBuffer>, numVertex: number): boolean =>
	colors.length === numVertex * STRIDE.COLORS_RGB ||
	colors.length === numVertex * STRIDE.COLORS_RGBA

/**
 * Per-element transform that converts a millimetre value to metres.
 * Pass to {@link asFloat32Array} to fuse the conversion into a single pass.
 *
 * @example
 * ```ts
 * const positions = asFloat32Array(line.positions, inMetres)
 * ```
 */
export const inMetres = (v: number): number => v * 0.001

/**
 * Returns true when `colors` is encoded as RGBA (4 bytes per color).
 * Prefers RGBA when length is divisible by both 3 and 4, matching the
 * convention used throughout the draw API.
 *
 * @example
 * ```ts
 * const stride = isRgba(colors) ? STRIDE.COLORS_RGBA : STRIDE.COLORS_RGB
 * ```
 */
export const isRgba = (colors: Uint8Array<ArrayBuffer>): boolean =>
	colors.length % STRIDE.COLORS_RGBA === 0

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
export const isSingleColor = (colors: Uint8Array<ArrayBuffer>): boolean =>
	colors.length === STRIDE.COLORS_RGB || colors.length === STRIDE.COLORS_RGBA
