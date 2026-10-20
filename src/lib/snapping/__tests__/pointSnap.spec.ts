import { Matrix4, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { pointSnap, SNAP_RADIUS_PX } from '../pointSnap'
import { box, PIXELS_PER_METRE, placed, topDownQuery } from './__fixtures__/snapFixtures'

const target = { shape: box(2, 2, 2), matrix: placed(5, 0, 1) }
const draggedCube = { shape: box(2, 2, 2), anchorToGeometry: new Matrix4() }

describe('pointSnap', () => {
	it('lands the dragged corner nearest the target corner on it', () => {
		const result = pointSnap(
			topDownQuery(
				{ x: 4, y: 1 },
				{ position: new Vector3(2.9, 1.9, 1), dragged: [draggedCube], targets: [target] }
			)
		)

		expect(
			result?.position.distanceTo(new Vector3(3, 2, 1)),
			'the dragged (3.9, 0.9, 2) corner should land on the target (4, 1, 2) corner'
		).toBeCloseTo(0)
		expect(result?.indicator).toEqual({ kind: 'point', point: new Vector3(4, 1, 2) })
	})

	it('picks the point nearer the camera of two that overlap on screen', () => {
		const result = pointSnap(
			topDownQuery({ x: 4, y: 1 }, { position: new Vector3(4, 1, 0.5), targets: [target] })
		)

		expect(result?.indicator).toEqual({ kind: 'point', point: new Vector3(4, 1, 2) })
	})

	it('skips a key point hidden behind the surface under the cursor', () => {
		const lid = { shape: box(4, 4, 1), matrix: placed(5, 0, 3) }
		const result = pointSnap(
			topDownQuery({ x: 4, y: 1 }, { position: new Vector3(), targets: [target, lid] })
		)

		expect(result).toBeNull()
	})

	it('skips a key point below the ground when the ground plane is on', () => {
		const buried = { shape: box(2, 2, 2), matrix: placed(5, 0, -2) }
		const result = pointSnap(
			topDownQuery(
				{ x: 4, y: 1 },
				{ position: new Vector3(), targets: [buried], groundPlane: true }
			)
		)

		expect(result).toBeNull()
	})

	it('still snaps to a corner of the box whose surface its own sight line grazes', () => {
		const result = pointSnap(
			topDownQuery({ x: 6, y: -1 }, { position: new Vector3(), targets: [target] })
		)

		expect(result?.indicator).toEqual({ kind: 'point', point: new Vector3(6, -1, 2) })
	})

	it('sets cubes flush side by side when edge midpoints meet', () => {
		const result = pointSnap(
			topDownQuery(
				{ x: 4, y: 0 },
				{ position: new Vector3(2.9, 0.1, 1.1), dragged: [draggedCube], targets: [target] }
			)
		)

		expect(result?.position.distanceTo(new Vector3(3, 0, 1))).toBeCloseTo(0)
	})

	it('snaps a frame without geometry by its origin', () => {
		const result = pointSnap(
			topDownQuery({ x: 4, y: 1 }, { position: new Vector3(3.9, 1.1, 2), targets: [target] })
		)

		expect(result?.position.distanceTo(new Vector3(4, 1, 2))).toBeCloseTo(0)
	})

	it('ignores a key point beyond the snap radius', () => {
		const offset = (SNAP_RADIUS_PX + 1) / PIXELS_PER_METRE
		const result = pointSnap(
			topDownQuery({ x: 4 + offset, y: 1 }, { position: new Vector3(), targets: [target] })
		)

		expect(result).toBeNull()
	})

	it('moves only along a constrained axis', () => {
		const result = pointSnap(
			topDownQuery(
				{ x: 4, y: 1 },
				{
					position: new Vector3(3.5, 0, 0),
					targets: [target],
					constraint: { kind: 'axis', direction: new Vector3(1, 0, 0) },
				}
			)
		)

		expect(result?.position.distanceTo(new Vector3(4, 0, 0))).toBeCloseTo(0)
	})
})
