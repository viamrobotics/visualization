import { injectPlugin, isInstanceOf } from '@threlte/core'
import { BatchedMesh, Mesh, Points, type Raycaster } from 'three'
import {
	acceleratedRaycast,
	BVHHelper,
	type BVHOptions,
	computeBatchedBoundsTree,
	computeBoundsTree,
	disposeBatchedBoundsTree,
	disposeBoundsTree,
	PointsBVH,
	SAH,
} from 'three-mesh-bvh'

import { pointsBvhOptions, raycastNearestPointToRay } from '$lib/three/pointsBvh'

interface Options extends BVHOptions {
	helper?: boolean
	enabled?: boolean
}

export const bvh = (raycaster: Raycaster, options?: () => Options) => {
	const bvhOptions = $derived<Options>({
		strategy: SAH,
		verbose: false,
		setBoundingBox: true,
		maxDepth: 20,
		targetLeafSize: 10,
		indirect: false,
		helper: false,
		...options?.(),
	})

	raycaster.firstHitOnly = true
	raycaster.params.Points.threshold = 0.005

	injectPlugin('bvh', (args) => {
		const { props } = $derived(args)
		const opts = $derived<Options>(props.bvh ? { ...bvhOptions, ...props.bvh } : bvhOptions)

		let computed = false
		let helper: BVHHelper | undefined

		$effect(() => {
			const { ref } = args

			if (computed) return
			if (opts.enabled === false) return

			/**
			 * `InstancedMesh2` brings its own per-instance BVH raycast (and a
			 * real `bvh` field, so it can't even take a `bvh` opt-out prop —
			 * Threlte would assign the prop onto the object and clobber it).
			 * Patching it with three-mesh-bvh's `acceleratedRaycast` would
			 * test only the unit geometry, so skip it entirely.
			 */
			if ((ref as { isInstancedMesh2?: boolean }).isInstancedMesh2) return

			// Some PCDs parse without a position attribute, and the BVH build reads it.
			if (isInstanceOf(ref, 'Points') && ref.geometry?.attributes.position) {
				ref.geometry.computeBoundsTree = computeBoundsTree
				ref.geometry.disposeBoundsTree = disposeBoundsTree
				ref.raycast = raycastNearestPointToRay
				// A cloud parsed in a worker arrives with its tree already built, and rebuilding it
				// here would stall the main thread for as long as the parse itself took.
				if (!ref.geometry.boundsTree) {
					computeBoundsTree.call(ref.geometry, { type: PointsBVH, ...opts, ...pointsBvhOptions })
				}
			} else if (isInstanceOf(ref, 'BatchedMesh')) {
				/* @ts-expect-error Some sort of ambient type is conflicing here, likely from @threlte/extras */
				ref.geometry.computeBoundsTree = computeBatchedBoundsTree
				ref.geometry.disposeBoundsTree = disposeBatchedBoundsTree
				ref.raycast = acceleratedRaycast
				// Line2 passes the Mesh check but stores its vertices in interleaved instance attributes, so a missing position attribute is the only signal it is not a plain mesh.
			} else if (isInstanceOf(ref, 'Mesh') && ref.geometry?.attributes.position) {
				ref.geometry.computeBoundsTree = computeBoundsTree
				ref.geometry.disposeBoundsTree = disposeBoundsTree
				ref.raycast = acceleratedRaycast
				computeBoundsTree.call(ref.geometry, opts)
			} else {
				return
			}

			if (opts.helper) {
				helper = new BVHHelper(ref)
				ref.add(helper)
			}
			computed = true
		})

		$effect(() => {
			const { ref } = args
			return () => {
				if (!computed) return
				if (isInstanceOf(ref, 'Points')) {
					ref.geometry.disposeBoundsTree?.()
					ref.raycast = Points.prototype.raycast
				} else if (isInstanceOf(ref, 'BatchedMesh')) {
					ref.geometry.disposeBoundsTree?.()
					ref.raycast = BatchedMesh.prototype.raycast
				} else if (isInstanceOf(ref, 'Mesh')) {
					ref.geometry.disposeBoundsTree?.()
					ref.raycast = Mesh.prototype.raycast
				}
				if (helper) {
					ref.remove(helper)
					helper = undefined
				}
				computed = false
			}
		})
	})
}
