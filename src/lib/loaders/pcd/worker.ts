import { Vector3 } from 'three'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

import type { LODProgressMessage, Message } from './messages'

const loader = new PCDLoader()
const size = new Vector3()

const LOD_THRESHOLD = 100_000

/**
 * Downsamples a point cloud to keep an exact fraction of the original points.
 *
 * Uses a Bresenham-style accumulator to select evenly-spaced points from the
 * input array. For each input point, the fraction is added to an accumulator.
 * When the accumulator reaches 1, that point is kept and the accumulator wraps.
 * This produces a deterministic, evenly-distributed subset without randomness
 * or spatial indexing.
 *
 * Properties:
 * - Exact: fraction=0.85 on 100k points always yields exactly 85k points.
 * - Predictable: the same input always produces the same output, avoiding
 *   flickering when point clouds update on a live feed.
 * - Distribution-agnostic: unlike voxel grid downsampling, the reduction ratio
 *   does not depend on the spatial distribution or density of points. A sparse
 *   cloud and a dense cloud with the same point count produce the same-sized output.
 * - Fast: O(n) with no Map/Set allocation, just a single pass over the arrays.
 *
 * @param positions - Source positions array (3 floats per point: x, y, z)
 * @param colors - Source colors array, or null if the cloud has no color data
 * @param fraction - The fraction of points to keep, between 0 and 1
 * @param colorStride - Number of color components per point (3 for RGB, 4 for RGBA)
 */
const fractionalDownsample = (
	positions: Float32Array,
	colors: Uint8Array | null,
	fraction: number,
	colorStride: number
): { positions: Float32Array<ArrayBuffer>; colors: Uint8Array<ArrayBuffer> | null } => {
	const numPoints = positions.length / 3
	const outCount = Math.round(numPoints * fraction)
	const outPositions = new Float32Array(outCount * 3)
	const outColors = colors ? new Uint8Array(outCount * colorStride) : null

	let accumulator = 0
	let j = 0

	for (let i = 0; i < numPoints && j < outCount; i++) {
		accumulator += fraction
		if (accumulator >= 1) {
			accumulator -= 1

			outPositions[j * 3] = positions[i * 3]!
			outPositions[j * 3 + 1] = positions[i * 3 + 1]!
			outPositions[j * 3 + 2] = positions[i * 3 + 2]!

			if (outColors && colors) {
				const srcOff = i * colorStride
				const dstOff = j * colorStride
				for (let c = 0; c < colorStride; c++) {
					outColors[dstOff + c] = colors[srcOff + c]!
				}
			}

			j++
		}
	}

	return { positions: outPositions, colors: outColors }
}

const sendLODLevel = (
	id: number,
	level: number,
	distance: number,
	positions: Float32Array<ArrayBuffer>,
	colors: Uint8Array<ArrayBuffer> | null,
	done: boolean,
	diagonal: number
) => {
	const msg: LODProgressMessage = {
		id,
		lod: { level, distance, positions, colors },
		done,
		boundingBoxDiagonal: diagonal,
	}

	const transfer: ArrayBuffer[] = [positions.buffer]
	if (colors) transfer.push(colors.buffer)
	postMessage(msg, transfer)
}

globalThis.onmessage = async (event) => {
	const { data, id } = event.data
	if (!(data instanceof Uint8Array)) {
		postMessage({ id, error: 'Invalid data format' } satisfies Message)
		return
	}

	try {
		const pcd = loader.parse(data.buffer as ArrayBuffer)
		if (pcd.geometry) {
			/**
			 * Positions is _usually_ defined. However, we have experienced parsing PCDs from Viam APIs that
			 * result in the Three.js parser not attaching this attribute, throwing errors downstream.
			 */
			const positions =
				(pcd.geometry.attributes.position?.array as Float32Array<ArrayBuffer>) ??
				new Float32Array(0)
			const colorsFloat: Float32Array | null =
				(pcd.geometry.attributes.color?.array as Float32Array<ArrayBuffer>) ?? null
			const colors = colorsFloat ? new Uint8Array(colorsFloat.length) : null

			if (colors) {
				for (let i = 0, l = colorsFloat.length; i < l; i++) {
					colors[i] = Math.round(colorsFloat[i] * 255)
				}
			}

			const numPoints = positions.length / 3

			if (numPoints >= LOD_THRESHOLD) {
				pcd.geometry.computeBoundingBox()
				const bbox = pcd.geometry.boundingBox!
				bbox.getSize(size)
				const diagonal = size.length()

				const colorStride = colors ? colors.length / numPoints : 0

				const lodConfigs = [
					{ level: 6, fraction: 0.05, distance: diagonal * 8 },
					{ level: 5, fraction: 0.15, distance: diagonal * 4 },
					{ level: 4, fraction: 0.3, distance: diagonal * 2 },
					{ level: 3, fraction: 0.5, distance: diagonal * 1 },
					{ level: 2, fraction: 0.7, distance: diagonal * 0.5 },
					{ level: 1, fraction: 0.85, distance: diagonal * 0.25 },
				]

				// Send coarsest to finest
				for (const { level, fraction, distance } of lodConfigs) {
					const result = fractionalDownsample(positions, colors, fraction, colorStride)
					sendLODLevel(id, level, distance, result.positions, result.colors, false, diagonal)
				}

				// LOD 0 (full resolution)
				sendLODLevel(id, 0, 0, positions, colors, true, diagonal)
			} else {
				// Small cloud — single message, no LOD
				postMessage(
					{ positions, colors, id } satisfies Message,
					colors ? [positions.buffer, colors.buffer] : [positions.buffer]
				)
			}
		} else {
			postMessage({ id, error: 'Failed to extract geometry' } satisfies Message)
		}
	} catch (error) {
		postMessage({ id, error: (error as Error).message } satisfies Message)
	}
}
