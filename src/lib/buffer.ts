/**
 * Zero-copy buffer utilities for converting protobuf bytes to Three.js typed arrays.
 *
 * Proto messages pack float32 data as `Uint8Array` (bytes fields). These utilities
 * provide efficient conversion to `Float32Array` for Three.js BufferAttributes.
 */

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
	/** Colors: [r, g, b] per color (uint8) */
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
export const asFloat32Array = (bytes: Uint8Array): Float32Array => {
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
 * Converts uint8 RGBA colors to normalized float32 colors (0-1 range).
 * Three.js expects colors in 0-1 range for BufferAttributes.
 *
 * @param colors - Uint8Array of RGBA color data [r, g, b, a, ...]
 * @returns Float32Array with normalized color values
 *
 * @example
 * ```ts
 * const colors = normalizeColorsRGBA(metadata.colors)
 * geometry.setAttribute('color', new BufferAttribute(colors, 4))
 * ```
 */
export const normalizeColorsRGBA = (colors: Uint8Array): Float32Array => {
	const normalized = new Float32Array(colors.length)
	for (let i = 0; i < colors.length; i++) {
		normalized[i] = colors[i] / 255
	}
	return normalized
}

/**
 * Converts uint8 RGB colors to normalized float32 colors (0-1 range).
 * Drops alpha channel if present (every 4th byte).
 *
 * @param colors - Uint8Array of RGBA color data [r, g, b, a, ...]
 * @returns Float32Array with normalized RGB values (no alpha)
 *
 * @example
 * ```ts
 * const colors = normalizeColorsRGB(metadata.colors)
 * geometry.setAttribute('color', new BufferAttribute(colors, 3))
 * ```
 */
export const normalizeColorsRGB = (colors: Uint8Array): Float32Array => {
	const numColors = Math.floor(colors.length / 4)
	const normalized = new Float32Array(numColors * 3)
	for (let i = 0; i < numColors; i++) {
		const srcOffset = i * 4
		const dstOffset = i * 3
		normalized[dstOffset] = colors[srcOffset] / 255
		normalized[dstOffset + 1] = colors[srcOffset + 1] / 255
		normalized[dstOffset + 2] = colors[srcOffset + 2] / 255
	}
	return normalized
}

/**
 * Extracts a single RGBA color from the beginning of a colors array.
 * Useful for shapes that use a single color for all elements.
 *
 * @param colors - Uint8Array of RGBA color data
 * @returns Object with normalized r, g, b, a values (0-1 range)
 *
 * @example
 * ```ts
 * const { r, g, b, a } = extractSingleColor(metadata.colors)
 * material.color.setRGB(r, g, b)
 * material.opacity = a
 * ```
 */
export const extractSingleColor = (
	colors: Uint8Array
): { r: number; g: number; b: number; a: number } => {
	if (colors.length < 4) {
		return { r: 1, g: 1, b: 1, a: 1 }
	}

	const normalized = normalizeColorsRGBA(colors)
	return {
		r: normalized[0],
		g: normalized[1],
		b: normalized[2],
		a: normalized[3],
	}
}

/**
 * Calculates the number of elements in a packed float32 array given a stride.
 *
 * @param bytes - The raw bytes from a protobuf bytes field
 * @param stride - Number of floats per element (use STRIDE constants)
 * @returns Number of complete elements in the array
 *
 * @example
 * ```ts
 * const numArrows = getElementCount(arrows.poses, STRIDE.ARROWS)
 * const numPoints = getElementCount(points.positions, STRIDE.POSITIONS)
 * ```
 */
export const getElementCount = (bytes: Uint8Array, stride: number): number => {
	const floatCount = bytes.byteLength / 4
	return Math.floor(floatCount / stride)
}
