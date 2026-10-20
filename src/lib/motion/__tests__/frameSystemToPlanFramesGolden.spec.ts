import { robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { buildFrameDescriptors } from '../frameDescriptors'
import { frameSystemToPlanFrames } from '../frameSystemToPlanFrames'
import {
	describableFrameNames,
	framePosesAgainstGolden,
	frameSystemGoldenCases,
	frameSystemGoldenProbes,
	geometryPosesAgainstGolden,
} from './__fixtures__/frameSystemGolden'

/** The scene as a robot's `FrameSystemConfig` RPC returns it, decoded the way the SDK would. */
const descriptorsFromParts = (parts: unknown[]) =>
	buildFrameDescriptors(
		frameSystemToPlanFrames(parts.map((part) => robotApi.FrameSystemConfig.fromJson(part as never)))
	)

describe('frameSystemToPlanFrames, against the frame system RDK builds from the same parts', () => {
	it('reads all 3 scenes the Go generator wrote', () => {
		expect(frameSystemGoldenCases.length).toBe(3)
	})

	it.each(frameSystemGoldenCases)(
		'synthesizes every frame of $name that RDK builds, less its models',
		({ frameSystem, parts }) => {
			const described = descriptorsFromParts(parts).map((descriptor) => descriptor.name)

			expect(described.toSorted()).toEqual(describableFrameNames(frameSystem).toSorted())
		}
	)
})

describe('frameSystemToPlanFrames composed to world, against FrameSystem.Transform', () => {
	it.each(frameSystemGoldenProbes)(
		'puts every frame of $name where RDK does at probe $index',
		(goldenProbe) => {
			const { actual, expected } = framePosesAgainstGolden(
				descriptorsFromParts(goldenProbe.parts),
				goldenProbe
			)

			expect(actual).toEqual(expected)
		}
	)
})

describe('frameSystemToPlanFrames geometry centres, against FrameSystemGeometries', () => {
	it.each(frameSystemGoldenProbes)(
		'puts every geometry of $name where RDK does at probe $index',
		(goldenProbe) => {
			const { names, actual, expected } = geometryPosesAgainstGolden(
				descriptorsFromParts(goldenProbe.parts),
				goldenProbe
			)

			expect(names.toSorted()).toEqual(Object.keys(goldenProbe.probe.geometries).toSorted())
			expect(actual).toEqual(expected)
		}
	)
})
