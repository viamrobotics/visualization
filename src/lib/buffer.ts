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
	/** Colors: [r, g, b] per color (uint8) — always RGB */
	COLORS_RGB: 3,
} as const

/**
 * Creates a Float32Array view over a Uint8Array without copying data.
 * Falls back to a copy if the buffer is not 4-byte aligned (rare with protobuf).
 *
 * @param bytes - The raw bytes from a protobuf bytes field
 * @returns A Float32Array view or copy of the data
 *
 * @example
 * ```ts
 * const positions = asFloat32Array(line.positions)
 * geometry.setAttribute('position', new BufferAttribute(positions, 3))
 * ```
 */
export const asFloat32Array = (bytes: Uint8Array<ArrayBuffer>): Float32Array<ArrayBuffer> => {
	if (bytes.length === 0) {
		return new Float32Array(0)
	}

	if (bytes.byteOffset % 4 === 0 && bytes.byteLength % 4 === 0) {
		return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
	}

	const aligned = new Float32Array(bytes.byteLength / 4)
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	for (let i = 0; i < aligned.length; i++) {
		aligned[i] = view.getFloat32(i * 4, true) // little-endian
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
export const asColor = (bytes: Uint8Array<ArrayBuffer>, target: Color, offset = 0): Color => {
	if (bytes.length < offset + 3) return target.setRGB(0, 0, 0)
	return target.setRGB(bytes[offset]! / 255, bytes[offset + 1]! / 255, bytes[offset + 2]! / 255)
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
export const asOpacity = (
	opacities: Uint8Array<ArrayBuffer> | undefined,
	fallback = 1,
	index = 0
): number => {
	if (!opacities || opacities.length === 0) return fallback
	// If only one opacity byte, it is the uniform opacity regardless of index
	const i = opacities.length === 1 ? 0 : index
	if (opacities.length <= i) return fallback
	return opacities[i]! / 255
}

/**
 * Returns true when `colors` contains exactly one RGB color entry per vertex.
 * Use this to distinguish per-vertex color buffers from a single uniform color.
 *
 * @param colors - Uint8Array of packed RGB bytes (stride of 3)
 * @param numVertex - Number of points/vertices the color buffer should cover
 *
 * @example
 * ```ts
 * if (isPerVertexColors(colors, positions.length / STRIDE.POSITIONS)) {
 *   // treat as per-vertex
 * } else {
 *   addColorTraits(entityTraits, colors, opacities)
 * }
 * ```
 */
export const isPerVertexColors = (colors: Uint8Array<ArrayBuffer>, numVertex: number): boolean =>
	colors.length === numVertex * STRIDE.COLORS_RGB
