import { describe, expect, it } from 'vitest'

import { Pose, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'

import { frameWorldMatrix } from '../frameWorldMatrix'

const frame = (name: string, parent: string, pose: Partial<Pose> = {}): Transform =>
	new Transform({
		referenceFrame: name,
		poseInObserverFrame: new PoseInFrame({
			referenceFrame: parent,
			pose: new Pose({ oZ: 1, ...pose }),
		}),
	})

describe('frameWorldMatrix', () => {
	it('is identity for a root at identity under world', () => {
		const world = frameWorldMatrix([frame('root', 'world')], 'root')
		expect(world?.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
	})

	it('composes a two-level chain with rotation, in metres', () => {
		const transforms = [
			frame('root', 'world'),
			frame('base', 'root', { x: 1000, theta: 90 }),
			frame('arm', 'base', { x: 500 }),
		]
		const world = frameWorldMatrix(transforms, 'arm')
		// base is at x = 1 m turned 90 degrees about z, so arm's local +x points along world +y.
		expect(world?.elements[12]).toBeCloseTo(1)
		expect(world?.elements[13]).toBeCloseTo(0.5)
		expect(world?.elements[14]).toBeCloseTo(0)
	})

	it('returns undefined for an unknown name', () => {
		expect(frameWorldMatrix([frame('root', 'world')], 'missing')).toBeUndefined()
	})

	it('throws for a parent chain that loops', () => {
		const transforms = [frame('a', 'b'), frame('b', 'a')]
		expect(() => frameWorldMatrix(transforms, 'a')).toThrow()
	})
})
