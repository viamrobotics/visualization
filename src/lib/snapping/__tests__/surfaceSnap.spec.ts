import { Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { surfaceSnap } from '../surfaceSnap'
import { box, placed, topDownQuery } from './__fixtures__/snapFixtures'

const table = { shape: box(4, 4, 1), matrix: placed(0, 0, 0.5) }
const draggedCube = { shape: box(1, 1, 1), anchorToGeometry: new Matrix4() }

describe('surfaceSnap', () => {
	it('sets a dragged cube on the surface under the cursor', () => {
		const result = surfaceSnap(
			topDownQuery(
				{ x: 1, y: 0.5 },
				{ position: new Vector3(3, 3, 3), dragged: [draggedCube], targets: [table] }
			)
		)

		expect(result?.position.distanceTo(new Vector3(1, 0.5, 1.5))).toBeCloseTo(0)
		expect(result?.indicator.kind).toBe('surface')
	})

	it('sets the geometry down, not the frame origin, when the geometry hangs below its frame', () => {
		const offsetCube = { shape: box(1, 1, 1), anchorToGeometry: placed(0, 0, -0.25) }
		const result = surfaceSnap(
			topDownQuery(
				{ x: 0, y: 0 },
				{ position: new Vector3(), dragged: [offsetCube], targets: [table] }
			)
		)

		expect(result?.position.z).toBeCloseTo(1.75)
	})

	it('sets down whichever dragged geometry reaches lowest', () => {
		const lowerCube = { shape: box(1, 1, 1), anchorToGeometry: placed(0, 0, -1) }
		const result = surfaceSnap(
			topDownQuery(
				{ x: 0, y: 0 },
				{ position: new Vector3(), dragged: [draggedCube, lowerCube], targets: [table] }
			)
		)

		expect(result?.position.z).toBeCloseTo(2.5)
	})

	it('does nothing for a frame without geometry', () => {
		const result = surfaceSnap(topDownQuery({ x: 0, y: 0 }, { targets: [table] }))

		expect(result).toBeNull()
	})

	it('sets the cube on the ground only when the ground plane is on', () => {
		const query = { position: new Vector3(9, 9, 9), dragged: [draggedCube] }

		expect(surfaceSnap(topDownQuery({ x: 5, y: 5 }, query))).toBeNull()

		const result = surfaceSnap(topDownQuery({ x: 5, y: 5 }, { ...query, groundPlane: true }))
		expect(result?.position.distanceTo(new Vector3(5, 5, 0.5))).toBeCloseTo(0)
	})

	it('prefers a target over the ground beneath it', () => {
		const result = surfaceSnap(
			topDownQuery({ x: 0, y: 0 }, { dragged: [draggedCube], targets: [table], groundPlane: true })
		)

		expect(result?.position.z).toBeCloseTo(1.5)
	})

	it('tilts the cube onto a slanted surface when aligning', () => {
		const slope = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6)
		const ramp = { shape: box(10, 10, 1), matrix: placed(0, 0, 0, slope) }
		const result = surfaceSnap(
			topDownQuery({ x: 0, y: 0 }, { dragged: [draggedCube], targets: [ramp], alignRotation: true })
		)

		const up = new Vector3(0, 0, 1).applyQuaternion(result?.orientation ?? new Quaternion())
		expect(up.distanceTo(new Vector3(0, 0, 1).applyQuaternion(slope))).toBeCloseTo(0)
	})

	it('keeps the drag orientation when not aligning', () => {
		const slope = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6)
		const ramp = { shape: box(10, 10, 1), matrix: placed(0, 0, 0, slope) }
		const result = surfaceSnap(
			topDownQuery({ x: 0, y: 0 }, { dragged: [draggedCube], targets: [ramp] })
		)

		expect(result?.orientation.angleTo(new Quaternion())).toBeCloseTo(0)
	})

	it('drops along a vertical axis constraint without moving sideways', () => {
		const result = surfaceSnap(
			topDownQuery(
				{ x: 1, y: 1 },
				{
					position: new Vector3(0.8, 1.2, 4),
					dragged: [draggedCube],
					targets: [table],
					constraint: { kind: 'axis', direction: new Vector3(0, 0, 1) },
				}
			)
		)

		expect(result?.position.distanceTo(new Vector3(0.8, 1.2, 1.5))).toBeCloseTo(0)
	})

	it('does not snap when the constraint cannot move toward the surface', () => {
		const result = surfaceSnap(
			topDownQuery(
				{ x: 0, y: 0 },
				{
					position: new Vector3(0, 0, 4),
					dragged: [draggedCube],
					targets: [table],
					constraint: { kind: 'plane', normal: new Vector3(0, 0, 1) },
				}
			)
		)

		expect(result).toBeNull()
	})
})
