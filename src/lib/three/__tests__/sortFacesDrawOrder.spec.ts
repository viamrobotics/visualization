import { Color, MeshBasicMaterial } from 'three'
import { describe, expect, it } from 'vitest'

import { createShapeBatches } from '../shapeBatches'
import { sortFacesDrawOrder } from '../sortFacesDrawOrder'

interface DrawRange {
	start: number
	count: number
	z: number
	index: number
}

const createFaces = (opacities: number[]) => {
	const batches = createShapeBatches(new MeshBasicMaterial({ transparent: true }))
	const ids = opacities.map((opacity) => {
		const instance = batches.add('box')
		batches.setAppearance(instance, new Color('white'), opacity, true)
		return instance.face
	})
	return { faces: batches.faces, ids }
}

const drawOrder = (faces: ReturnType<typeof createFaces>['faces'], ranges: DrawRange[]) => {
	sortFacesDrawOrder.call(faces, ranges)
	return ranges.map((range) => range.index)
}

describe('sortFacesDrawOrder, the faces batch draw order', () => {
	it('draws opaque instances in id order whatever their distance, so coplanar ties resolve the same from every angle', () => {
		const { faces, ids } = createFaces([1, 1])
		const [part, zone] = ids

		const zoneNearer = [
			{ start: 0, count: 3, z: 5, index: part },
			{ start: 0, count: 3, z: 1, index: zone },
		]
		const partNearer = [
			{ start: 0, count: 3, z: 1, index: part },
			{ start: 0, count: 3, z: 5, index: zone },
		]

		expect(drawOrder(faces, zoneNearer)).toEqual([part, zone])
		expect(drawOrder(faces, partNearer)).toEqual([part, zone])
	})

	it('draws translucent instances after every opaque one, farthest first', () => {
		const { faces, ids } = createFaces([0.5, 1, 0.5])
		const [nearGlass, solid, farGlass] = ids

		const ranges = [
			{ start: 0, count: 3, z: 1, index: nearGlass },
			{ start: 0, count: 3, z: 9, index: solid },
			{ start: 0, count: 3, z: 4, index: farGlass },
		]

		expect(drawOrder(faces, ranges)).toEqual([solid, farGlass, nearGlass])
	})

	it('is installed on the faces batch', () => {
		const { faces } = createFaces([])

		expect(faces.customSort).toBe(sortFacesDrawOrder)
	})
})
