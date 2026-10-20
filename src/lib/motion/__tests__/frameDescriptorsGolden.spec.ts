import { describe, expect, it } from 'vitest'

import { buildFrameDescriptors } from '../frameDescriptors'
import {
	describableFrameNames,
	framePosesAgainstGolden,
	frameSystemGoldenCases,
	frameSystemGoldenProbes,
	geometryPosesAgainstGolden,
} from './__fixtures__/frameSystemGolden'

describe('buildFrameDescriptors, against a frame system RDK marshaled', () => {
	it('reads all 3 scenes the Go generator wrote', () => {
		expect(frameSystemGoldenCases.length).toBe(3)
	})

	it.each(frameSystemGoldenCases)(
		'describes every frame of $name except its models',
		({ frameSystem }) => {
			const described = buildFrameDescriptors(frameSystem).map((descriptor) => descriptor.name)

			expect(described.toSorted()).toEqual(describableFrameNames(frameSystem).toSorted())
		}
	)
})

describe('buildFrameDescriptors composed to world, against FrameSystem.Transform', () => {
	it.each(frameSystemGoldenProbes)(
		'puts every frame of $name where RDK does at probe $index',
		(goldenProbe) => {
			const { actual, expected } = framePosesAgainstGolden(
				buildFrameDescriptors(goldenProbe.frameSystem),
				goldenProbe
			)

			expect(actual).toEqual(expected)
		}
	)
})

describe('buildFrameDescriptors geometry centres, against FrameSystemGeometries', () => {
	it.each(frameSystemGoldenProbes)(
		'puts every geometry of $name where RDK does at probe $index',
		(goldenProbe) => {
			const { names, actual, expected } = geometryPosesAgainstGolden(
				buildFrameDescriptors(goldenProbe.frameSystem),
				goldenProbe
			)

			expect(names.toSorted()).toEqual(Object.keys(goldenProbe.probe.geometries).toSorted())
			expect(actual).toEqual(expected)
		}
	)
})
