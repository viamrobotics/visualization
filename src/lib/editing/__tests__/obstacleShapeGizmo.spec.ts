import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createComplexObstacleComponent } from '$lib/obstacle'

import { shapeOffsetFromGizmo, withObstacleShapePatch } from '../obstacleShapeGizmo'

describe('shapeOffsetFromGizmo', () => {
	it('measures the dragged shape from its obstacle frame, in millimetres', () => {
		const obstacleAtOneMetreX = new Matrix4().makeTranslation(1, 0, 0)
		const draggedTo = new Matrix4().makeTranslation(1.25, 0.5, 0)

		const offset = shapeOffsetFromGizmo(obstacleAtOneMetreX, draggedTo)

		expect([offset.x, offset.y, offset.z]).toEqual([250, 500, 0])
	})

	it('measures within a rotated obstacle frame', () => {
		const obstacleTurnedQuarter = new Matrix4().makeRotationZ(Math.PI / 2)
		const draggedAlongWorldY = new Matrix4().makeTranslation(0, 0.1, 0)

		const offset = shapeOffsetFromGizmo(obstacleTurnedQuarter, draggedAlongWorldY)

		expect(offset.x).toBeCloseTo(100)
		expect(offset.y).toBeCloseTo(0)
	})
})

describe('withObstacleShapePatch', () => {
	it('patches only the shape at the index and keeps the other attributes', () => {
		const obstacle: PartComponent = {
			...createComplexObstacleComponent('cage'),
			attributes: {
				extra: 'kept',
				geometries: [
					{ label: 'a', type: 'box', x: 10, y: 10, z: 10 },
					{ label: 'b', type: 'sphere', r: 5 },
				],
			},
		}

		const attributes = withObstacleShapePatch(obstacle, 1, { translation: { x: 1, y: 2, z: 3 } })

		expect(attributes).toEqual({
			extra: 'kept',
			geometries: [
				{ label: 'a', type: 'box', x: 10, y: 10, z: 10 },
				{ label: 'b', type: 'sphere', r: 5, translation: { x: 1, y: 2, z: 3 } },
			],
		})
	})
})
