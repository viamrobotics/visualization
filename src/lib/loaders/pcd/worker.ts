import { Vector3 } from 'three'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

import type { LODProgressMessage, Message } from './messages'

const loader = new PCDLoader()
const size = new Vector3()

const LOD_THRESHOLD = 100_000

/**
 * Spatially-aware point cloud downsampling using a voxel grid, sized to
 * approximate a target point count.
 *
 * The algorithm divides the bounding box into a uniform 3D grid of cubic cells.
 * For each input point, it computes which cell the point falls into. If that
 * cell hasn't been claimed yet, the point is kept; otherwise it's discarded.
 * The result is at most one point per cell — a fast approximation of Poisson
 * disk subsampling (and the same technique used by PCL and Open3D for point
 * cloud downsampling).
 *
 * The cell size is derived from a target fraction of points to keep:
 *
 *   targetCount = numPoints × fraction
 *   cellSize    = ∛(volume / targetCount)
 *
 * This sizes each cell so that, for a uniform distribution, roughly one point
 * lands per cell — yielding approximately `targetCount` output points. The
 * actual output count depends on the spatial distribution:
 *
 * - Dense clusters are thinned aggressively (many points share a cell).
 * - Sparse, isolated points are preserved (each occupies its own cell).
 *
 * This is exactly the behavior we want for LOD: redundant points in dense
 * areas are removed first, while points that define the shape's structure
 * in sparse areas are kept.
 *
 * The output count is approximate, not exact. For LOD purposes this is fine —
 * what matters is spatial quality, not hitting a precise number.
 *
 * Cells are identified by encoding their (cx, cy, cz) grid coordinates into a
 * single integer key: `cx + cy * gridSizeX + cz * gridSizeX * gridSizeY`.
 * A Map tracks which cells are occupied (first point wins).
 *
 * Performance: O(n) — one pass to bucket points, one pass to extract results.
 *
 * @param positions - Source positions (3 floats per point: x, y, z)
 * @param colors - Source colors, or null if the cloud has no color data
 * @param cellSize - Side length of each cubic voxel cell
 * @param minX - Bounding box minimum X
 * @param minY - Bounding box minimum Y
 * @param minZ - Bounding box minimum Z
 * @param rangeX - Bounding box extent in X (maxX - minX)
 * @param rangeY - Bounding box extent in Y (maxY - minY)
 * @param colorStride - Number of color components per point (3 for RGB, 4 for RGBA)
 */
const voxelDownsample = (
	positions: Float32Array,
	colors: Uint8Array | null,
	cellSize: number,
	minX: number,
	minY: number,
	minZ: number,
	rangeX: number,
	rangeY: number,
	colorStride: number
): { positions: Float32Array<ArrayBuffer>; colors: Uint8Array<ArrayBuffer> | null } => {
	const numPoints = positions.length / 3
	const gridSizeX = Math.ceil(rangeX / cellSize) + 1
	const gridSizeY = Math.ceil(rangeY / cellSize) + 1

	const occupied = new Map<number, number>()

	for (let i = 0; i < numPoints; i++) {
		const cx = Math.floor((positions[i * 3]! - minX) / cellSize)
		const cy = Math.floor((positions[i * 3 + 1]! - minY) / cellSize)
		const cz = Math.floor((positions[i * 3 + 2]! - minZ) / cellSize)
		const key = cx + cy * gridSizeX + cz * gridSizeX * gridSizeY

		if (!occupied.has(key)) {
			occupied.set(key, i)
		}
	}

	const outPositions = new Float32Array(occupied.size * 3)
	const outColors = colors ? new Uint8Array(occupied.size * colorStride) : null

	let j = 0
	for (const idx of occupied.values()) {
		outPositions[j * 3] = positions[idx * 3]!
		outPositions[j * 3 + 1] = positions[idx * 3 + 1]!
		outPositions[j * 3 + 2] = positions[idx * 3 + 2]!

		if (outColors && colors) {
			const srcOff = idx * colorStride
			const dstOff = j * colorStride
			for (let c = 0; c < colorStride; c++) {
				outColors[dstOff + c] = colors[srcOff + c]!
			}
		}

		j++
	}

	return { positions: outPositions, colors: outColors }
}

/**
 * Counts how many voxel cells would be occupied at a given cell size,
 * without allocating output arrays. Used to calibrate cell size before
 * running the full downsampling pass.
 */
const countOccupied = (
	positions: Float32Array,
	numPoints: number,
	cellSize: number,
	minX: number,
	minY: number,
	minZ: number,
	rangeX: number,
	rangeY: number
): number => {
	const gridSizeX = Math.ceil(rangeX / cellSize) + 1
	const gridSizeY = Math.ceil(rangeY / cellSize) + 1
	const occupied = new Set<number>()

	for (let i = 0; i < numPoints; i++) {
		const cx = Math.floor((positions[i * 3]! - minX) / cellSize)
		const cy = Math.floor((positions[i * 3 + 1]! - minY) / cellSize)
		const cz = Math.floor((positions[i * 3 + 2]! - minZ) / cellSize)
		occupied.add(cx + cy * gridSizeX + cz * gridSizeX * gridSizeY)
	}

	return occupied.size
}

/**
 * Finds a voxel cell size that produces approximately `targetCount` output
 * points, then runs the full downsampling at that cell size.
 *
 * Starts from an initial estimate (cbrt of volume / target) and iteratively
 * adjusts: counts occupied cells, then scales the cell size by the overshoot
 * ratio raised to a fractional power (~1/2.5, a compromise between the
 * quadratic scaling of surface data and the cubic scaling of volumetric data).
 * Converges in 2-3 iterations for typical point clouds.
 */
const voxelDownsampleToTarget = (
	positions: Float32Array,
	colors: Uint8Array | null,
	targetFraction: number,
	volume: number,
	minX: number,
	minY: number,
	minZ: number,
	rangeX: number,
	rangeY: number,
	colorStride: number
): { positions: Float32Array<ArrayBuffer>; colors: Uint8Array<ArrayBuffer> | null } => {
	const numPoints = positions.length / 3
	const targetCount = numPoints * targetFraction

	let cellSize = Math.cbrt(volume / targetCount)

	// Iteratively calibrate cell size to hit the target count
	for (let iter = 0; iter < 3; iter++) {
		const count = countOccupied(
			positions, numPoints, cellSize, minX, minY, minZ, rangeX, rangeY
		)

		const ratio = count / targetCount
		if (ratio > 0.9 && ratio < 1.1) break

		cellSize *= Math.pow(ratio, 1 / 2.5)
	}

	return voxelDownsample(
		positions, colors, cellSize, minX, minY, minZ, rangeX, rangeY, colorStride
	)
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
				const { x: minX, y: minY, z: minZ } = bbox.min
				const volume = Math.max(size.x * size.y * size.z, 1e-10)

				const lodConfigs = [
					{ level: 8, fraction: 0.05, distance: Math.min(diagonal * 8, 30) },
					{ level: 7, fraction: 0.10, distance: Math.min(diagonal * 6, 20) },
					{ level: 6, fraction: 0.20, distance: Math.min(diagonal * 4, 15) },
					{ level: 5, fraction: 0.35, distance: Math.min(diagonal * 2, 8) },
					{ level: 4, fraction: 0.50, distance: Math.min(diagonal * 1, 4) },
					{ level: 3, fraction: 0.65, distance: Math.min(diagonal * 0.5, 2) },
					{ level: 2, fraction: 0.80, distance: Math.min(diagonal * 0.25, 1) },
					{ level: 2, fraction: 0.92, distance: Math.min(diagonal * 0.1, 0.5) },
					{ level: 1, fraction: 0.97, distance: Math.min(diagonal * 0.05, 0.25) },
				]

				// Send coarsest to finest
				for (const { level, fraction, distance } of lodConfigs) {
					const result = voxelDownsampleToTarget(
						positions, colors, fraction, volume,
						minX, minY, minZ, size.x, size.y, colorStride
					)
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
