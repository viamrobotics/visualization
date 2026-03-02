import { injectPlugin, isInstanceOf } from '@threlte/core'
import { BatchedMesh, Points, Mesh, type Raycaster } from 'three'
import {
	type BVHOptions,
	acceleratedRaycast,
	computeBoundsTree,
	disposeBoundsTree,
	computeBatchedBoundsTree,
	disposeBatchedBoundsTree,
	PointsBVH,
	SAH,
	BVHHelper,
} from 'three-mesh-bvh'

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
		maxLeafSize: 10,
		indirect: false,
		helper: false,
		...options?.(),
	})

	raycaster.firstHitOnly = true
	raycaster.params.Points.threshold = 0.005

	injectPlugin('bvh', (args) => {
		const { props } = $derived(args)
		const opts = $derived<Options>(props.bvh ? { ...bvhOptions, ...props.bvh } : bvhOptions)

		$effect(() => {
			const { ref } = args

			if (opts.enabled === false) {
				return
			}

			if (isInstanceOf(ref, 'Points')) {
				ref.geometry.computeBoundsTree = computeBoundsTree
				ref.geometry.disposeBoundsTree = disposeBoundsTree
				ref.raycast = acceleratedRaycast
				computeBoundsTree.call(ref.geometry, { type: PointsBVH, ...opts })

				const helper = opts.helper ? new BVHHelper(ref) : undefined
				if (helper) ref.add(helper)

				return () => {
					ref.raycast = Points.prototype.raycast
					if (helper) ref.remove(helper)
				}
			} else if (isInstanceOf(ref, 'BatchedMesh')) {
				/* @ts-expect-error Some sort of ambient type is conflicing here, likely from @threlte/extras */
				ref.geometry.computeBoundsTree = computeBatchedBoundsTree
				ref.geometry.disposeBoundsTree = disposeBatchedBoundsTree
				ref.raycast = acceleratedRaycast

				const helper = opts.helper ? new BVHHelper(ref) : undefined
				if (helper) ref.add(helper)

				return () => {
					ref.raycast = BatchedMesh.prototype.raycast
					if (helper) ref.remove(helper)
				}
			} else if (isInstanceOf(ref, 'Mesh')) {
				ref.geometry.computeBoundsTree = computeBoundsTree
				ref.geometry.disposeBoundsTree = disposeBoundsTree
				ref.raycast = acceleratedRaycast
				computeBoundsTree.call(ref.geometry, opts)

				const helper = opts.helper ? new BVHHelper(ref) : undefined
				if (helper) ref.add(helper)

				return () => {
					ref.raycast = Mesh.prototype.raycast
					if (helper) ref.remove(helper)
				}
			}
		})
	})
}
