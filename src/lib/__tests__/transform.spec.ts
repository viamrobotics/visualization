import type { Pose } from '@viamrobotics/sdk'

import { describe, expect, it } from 'vitest'

import {
	composeEditedPoseForRenderedPose,
	composeRenderedPose,
	createPose,
	poseToMatrix,
} from '../transform'

const expectPoseCloseTo = (actual: Pose, expected: Partial<Pose>) => {
	if (expected.x !== undefined) expect(actual.x).toBeCloseTo(expected.x)
	if (expected.y !== undefined) expect(actual.y).toBeCloseTo(expected.y)
	if (expected.z !== undefined) expect(actual.z).toBeCloseTo(expected.z)
	if (expected.theta !== undefined) expect(actual.theta).toBeCloseTo(expected.theta)
}

describe('composed frame poses', () => {
	it('renders an edited rotation around the live frame pivot', () => {
		const baseline = createPose({ x: 10, y: 0, z: 0 })
		const live = createPose({ x: 100, y: 50, z: 0, oX: 0, oY: 0, oZ: 1, theta: 45 })
		const edited = createPose({ x: 10, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 90 })

		const rendered = composeRenderedPose(live, baseline, edited)

		expectPoseCloseTo(rendered, {
			x: 100,
			y: 50,
			z: 0,
			theta: 135,
		})
	})

	it('applies edited translation in the live frame basis', () => {
		const baseline = createPose({ x: 10, y: 0, z: 0 })
		const live = createPose({ x: 100, y: 50, z: 0, oX: 0, oY: 0, oZ: 1, theta: 90 })
		const edited = createPose({ x: 20, y: 0, z: 0 })

		const rendered = composeRenderedPose(live, baseline, edited)

		expectPoseCloseTo(rendered, {
			x: 100,
			y: 60,
			z: 0,
			theta: 90,
		})
	})

	it('solves the edited pose that renders to the gizmo target', () => {
		const baseline = createPose({ x: 10, y: 0, z: 0 })
		const live = createPose({ x: 100, y: 50, z: 0, oX: 0, oY: 0, oZ: 1, theta: 90 })
		const target = createPose({ x: 120, y: 80, z: 0, oX: 0, oY: 0, oZ: 1, theta: 180 })

		const edited = composeEditedPoseForRenderedPose(baseline, live, target)
		const rendered = composeRenderedPose(live, baseline, edited)
		const renderedElements = poseToMatrix(rendered).elements
		const targetElements = poseToMatrix(target).elements

		for (const [index, value] of renderedElements.entries()) {
			expect(value).toBeCloseTo(targetElements[index])
		}
	})
})
