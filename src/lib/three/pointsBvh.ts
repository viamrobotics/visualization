import type { BufferGeometry, Intersection, Points, Raycaster } from 'three'

import {
	acceleratedRaycast,
	type BVHOptions,
	CENTER,
	PointsBVH,
	SKIP_GENERATION,
} from 'three-mesh-bvh'

declare module 'three-mesh-bvh' {
	// Exported from the package entry point, and read by the constructor, but left out of the
	// type declarations on both counts.
	export const SKIP_GENERATION: unique symbol

	interface BVHOptions {
		[SKIP_GENERATION]?: boolean
	}
}

export const pointsBvhOptions = {
	// `SAH` weighs primitive surface area, which is zero for a point. It builds 4x slower than
	// `CENTER` on a 500k cloud and raycasts slower too.
	strategy: CENTER,
	// A direct build permutes `geometry.index`, so the point budget's draw-range prefix would
	// draw one corner of the cloud instead of the parse-time shuffle's uniform subsample.
	indirect: true,
	maxDepth: 40,
	targetLeafSize: 20,
} satisfies BVHOptions

/** The whole of a built tree, in two buffers that transfer across a worker boundary. */
export interface SerializedPointsBvh {
	roots: ArrayBuffer[]
	/** Narrows to `Uint16Array` at or below 65536 points, so neither type can be assumed. */
	indirectBuffer: Uint16Array | Uint32Array
}

/**
 * `three-mesh-bvh` publishes `serialize` and `deserialize` on `MeshBVH` alone, so a `PointsBVH`
 * can only be moved through the two fields those methods themselves read.
 */
interface PointsBvhInternals {
	_roots: ArrayBuffer[]
	_indirectBuffer: Uint16Array | Uint32Array
}

/**
 * Builds the tree wherever the points are already being walked, so the main thread never pays
 * for it. Costs roughly as much as parsing the cloud it came from.
 *
 * @returns `undefined` for a geometry carrying no position attribute, which some PCDs from Viam
 *   APIs parse into and the constructor throws on.
 */
export const buildPointsBvh = (geometry: BufferGeometry): SerializedPointsBvh | undefined => {
	if (!geometry.attributes.position) return undefined

	const bvh = new PointsBVH(geometry, pointsBvhOptions) as unknown as PointsBvhInternals

	return { roots: bvh._roots, indirectBuffer: bvh._indirectBuffer }
}

/**
 * Reconstitutes a tree built elsewhere around `geometry`, without walking a point.
 * `SKIP_GENERATION` is the same escape hatch `MeshBVH.deserialize` uses to build the shell of a
 * tree it is about to fill in.
 */
export const attachPointsBvh = (geometry: BufferGeometry, serialized: SerializedPointsBvh) => {
	const bvh = new PointsBVH(geometry, { ...pointsBvhOptions, [SKIP_GENERATION]: true })
	const internals = bvh as unknown as PointsBvhInternals

	internals._roots = serialized.roots
	internals._indirectBuffer = serialized.indirectBuffer

	geometry.boundsTree = bvh
}

/**
 * Reports the point nearest the cursor rather than the one nearest the camera.
 *
 * `PointsBVH.raycastObject3D` under `firstHitOnly` keeps whichever candidate has the smallest
 * `distance`, which is depth along the ray, so any point inside the threshold tube can win over
 * the one actually under the cursor. `distanceToRay` is the perpendicular distance, which is what
 * screen proximity is, and it already accounts for depth under a perspective camera: two points
 * projecting to the same pixel differ in perpendicular distance in proportion to their depth, so
 * the nearer one still wins. The tie-break covers an orthographic camera, where it does not.
 *
 * Assign to `Points.raycast` in place of `acceleratedRaycast`.
 */
export function raycastNearestPointToRay(
	this: Points,
	raycaster: Raycaster,
	intersects: Intersection[]
) {
	const candidates: Intersection[] = []

	// Collecting every candidate costs the traversal its distance-based early out. The tube is
	// one threshold wide, so what it gives up is a handful of leaf nodes.
	const { firstHitOnly } = raycaster
	raycaster.firstHitOnly = false
	acceleratedRaycast.call(this, raycaster, candidates)
	raycaster.firstHitOnly = firstHitOnly

	let nearest: Intersection | undefined
	for (const candidate of candidates) {
		if (
			nearest === undefined ||
			candidate.distanceToRay! < nearest.distanceToRay! ||
			(candidate.distanceToRay === nearest.distanceToRay && candidate.distance < nearest.distance)
		) {
			nearest = candidate
		}
	}

	if (nearest) intersects.push(nearest)
}
