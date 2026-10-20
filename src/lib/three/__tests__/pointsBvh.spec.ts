import type { Intersection } from 'three'

import { BufferAttribute, BufferGeometry, Points, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { attachPointsBvh, buildPointsBvh } from '../pointsBvh'

describe('a points BVH carried through its serialized form', () => {
	it('still raycasts to the point under the ray', () => {
		const geometry = new BufferGeometry()
		geometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]), 3)
		)
		attachPointsBvh(geometry, buildPointsBvh(geometry)!)

		const points = new Points(geometry)
		points.updateMatrixWorld()
		const raycaster = new Raycaster()
		raycaster.params.Points.threshold = 0.1
		raycaster.set(new Vector3(1, 0, 10), new Vector3(0, 0, -1))
		const hits: Intersection[] = []

		geometry.boundsTree!.raycastObject3D(points, raycaster, hits)

		expect(hits.map((hit) => hit.index)).toStrictEqual([1])
	})
})
