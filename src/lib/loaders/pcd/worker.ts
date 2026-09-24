import type { BufferGeometry } from 'three'

import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

import type { Bounds } from '../../attribute'
import type { Message } from './messages'

import { buildPointsBvh } from '../../three/pointsBvh'

const loader = new PCDLoader()

/**
 * A fixed seed keeps a cloud's permutation stable across refreshes, so a decimated view holds
 * still instead of resampling into a shimmer.
 */
const SHUFFLE_SEED = 1_013_904_223

const mulberry32 = (seed: number) => {
	let state = seed

	return () => {
		// eslint-disable-next-line unicorn/prefer-math-trunc -- needs 32-bit wrapping, not truncation
		state = (state + 0x6d_2b_79_f5) | 0
		let t = Math.imul(state ^ (state >>> 15), state | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
	}
}

/**
 * Selection sampling: after k steps the first k points are a uniform random sample of the whole
 * cloud, which is what lets the renderer decimate with `setDrawRange` alone. Sensors emit in scan
 * order, where a prefix would be an angular wedge. Stops at k rather than permuting everything,
 * so cost tracks what can actually be drawn instead of how big the cloud is.
 */
const shufflePoints = (positions: Float32Array, colors: Uint8Array | undefined, depth: number) => {
	const count = Math.floor(positions.length / 3)
	const limit = Math.max(0, Math.min(depth, count - 1))
	const hasColors = colors !== undefined && colors.length >= count * 3
	const random = mulberry32(SHUFFLE_SEED)

	for (let i = 0; i < limit; i++) {
		const j = i + Math.floor(random() * (count - i))
		if (i === j) continue

		const a = i * 3
		const b = j * 3

		for (let k = 0; k < 3; k++) {
			const position = positions[a + k]
			positions[a + k] = positions[b + k]
			positions[b + k] = position

			if (hasColors) {
				const color = colors[a + k]
				colors[a + k] = colors[b + k]
				colors[b + k] = color
			}
		}
	}

	// Swapping every slot but the last leaves the final one determined, so the whole cloud is a
	// uniform permutation rather than a prefix of one.
	return limit === count - 1 ? count : limit
}

/**
 * Measuring here spares the renderer a walk over every position on the next frame. Order-
 * independent, so it doesn't matter that the points have already been shuffled.
 */
const measure = (geometry: BufferGeometry): Bounds | undefined => {
	if (!geometry.attributes.position) return undefined

	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()

	const { boundingBox, boundingSphere } = geometry
	if (!boundingBox || !boundingSphere) return undefined

	const { min, max } = boundingBox
	const { center, radius } = boundingSphere

	return {
		min: { x: min.x, y: min.y, z: min.z },
		max: { x: max.x, y: max.y, z: max.z },
		center: { x: center.x, y: center.y, z: center.z },
		radius,
	}
}

globalThis.onmessage = async (event) => {
	const { data, id, shuffleDepth } = event.data
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
			const colorsFloat: Float32Array | undefined =
				(pcd.geometry.attributes.color?.array as Float32Array<ArrayBuffer>) ?? undefined
			const colors = colorsFloat ? new Uint8Array(colorsFloat.length) : undefined

			if (colors) {
				for (let i = 0, l = colorsFloat.length; i < l; i++) {
					colors[i] = Math.round(colorsFloat[i] * 255)
				}
			}

			const shuffled = shufflePoints(positions, colors, shuffleDepth)

			// After the shuffle, so the tree indexes the order the renderer will draw in.
			const boundsTree = buildPointsBvh(pcd.geometry)

			const transfer: Transferable[] = [positions.buffer]
			if (colors) transfer.push(colors.buffer)
			if (boundsTree) transfer.push(...boundsTree.roots, boundsTree.indirectBuffer.buffer)

			postMessage(
				{
					positions,
					colors,
					shuffled,
					bounds: measure(pcd.geometry),
					boundsTree,
					id,
				} satisfies Message,
				{ transfer }
			)
		} else {
			postMessage({ id, error: 'Failed to extract geometry' } satisfies Message)
		}
	} catch (error) {
		postMessage({ id, error: (error as Error).message } satisfies Message)
	}
}
