import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/buf/common/v1/common_pb'
import { Joint, KinematicsSpec, Link } from '$lib/buf/kinematics/v1/spec_pb'

import { carryJointSubtree } from '../carryJointSubtree'

const pose = (x = 0, y = 0, z = 0) => new Pose({ x, y, z, oX: 0, oY: 0, oZ: 1, theta: 0 })

const specWith = (parts: Partial<KinematicsSpec>) => new KinematicsSpec(parts)

describe('carryJointSubtree', () => {
	it('carries a child link and a child joint by a pure translation', () => {
		const draft = specWith({
			joints: [
				new Joint({ id: 'j1', origin: pose(100, 0, 0) }),
				new Joint({ id: 'j2', parent: 'j1', origin: pose(150, 0, 0) }),
			],
			links: [new Link({ id: 'a', parent: 'j1', origin: pose(120, 5, 0) })],
		})

		carryJointSubtree(draft, 'j1', pose(100, 30, 0))

		expect(draft.links[0]?.origin?.x).toBeCloseTo(120)
		expect(draft.links[0]?.origin?.y).toBeCloseTo(35)
		expect(draft.joints[1]?.origin?.x).toBeCloseTo(150)
		expect(draft.joints[1]?.origin?.y).toBeCloseTo(30)
	})

	it('leaves the moved joints own origin to the caller', () => {
		const draft = specWith({ joints: [new Joint({ id: 'j1', origin: pose(100, 0, 0) })] })

		carryJointSubtree(draft, 'j1', pose(0, 0, 0))

		expect(draft.joints[0]?.origin?.x).toBe(100)
	})

	it('swings an offset child link about the joint when the origin rotates', () => {
		const draft = specWith({
			joints: [new Joint({ id: 'j1', origin: pose(0, 0, 0) })],
			links: [new Link({ id: 'a', parent: 'j1', origin: pose(100, 0, 0) })],
		})

		carryJointSubtree(draft, 'j1', new Pose({ oZ: 1, theta: 90 }))

		const origin = draft.links[0]?.origin
		expect(origin?.x).toBeCloseTo(0)
		expect(origin?.y).toBeCloseTo(100)
		expect(origin?.oZ).toBeCloseTo(1)
		expect(origin?.theta).toBeCloseTo(90)
	})

	it('carries a grandchild link through a two-joint chain', () => {
		const draft = specWith({
			joints: [
				new Joint({ id: 'j1', origin: pose() }),
				new Joint({ id: 'j2', parent: 'j1', origin: pose(10, 0, 0) }),
			],
			links: [new Link({ id: 'a', parent: 'j2', origin: pose(20, 0, 0) })],
		})

		carryJointSubtree(draft, 'j1', pose(0, 0, 7))

		expect(draft.links[0]?.origin?.z).toBeCloseTo(7)
	})

	it.each([{ tcpParent: 'j1' }, { tcpParent: 'j2' }])(
		'carries a TCP whose parent is $tcpParent',
		({ tcpParent }) => {
			const draft = specWith({
				joints: [
					new Joint({ id: 'j1', origin: pose() }),
					new Joint({ id: 'j2', parent: 'j1', origin: pose(10, 0, 0) }),
				],
				tcpParent,
				tcpPose: pose(30, 0, 0),
			})

			carryJointSubtree(draft, 'j1', pose(0, 4, 0))

			expect(draft.tcpPose?.y).toBeCloseTo(4)
		}
	)

	it('reads an absent tcpPose as identity', () => {
		const draft = specWith({ joints: [new Joint({ id: 'j1', origin: pose() })], tcpParent: 'j1' })

		carryJointSubtree(draft, 'j1', pose(0, 0, 9))

		expect(draft.tcpPose?.z).toBeCloseTo(9)
	})

	it('leaves a root TCP and a link under a sibling joint where they are', () => {
		const draft = specWith({
			joints: [
				new Joint({ id: 'j1', origin: pose() }),
				new Joint({ id: 'sibling', origin: pose() }),
			],
			links: [new Link({ id: 'a', parent: 'sibling', origin: pose(5, 0, 0) })],
			tcpParent: '',
			tcpPose: pose(8, 0, 0),
		})

		carryJointSubtree(draft, 'j1', pose(50, 50, 50))

		expect(draft.links[0]?.origin?.x).toBe(5)
		expect(draft.tcpPose?.x).toBe(8)
		expect(draft.tcpPose?.y).toBe(0)
	})

	it('changes nothing for an unknown id', () => {
		const draft = specWith({
			joints: [new Joint({ id: 'j1', origin: pose() })],
			links: [new Link({ id: 'a', parent: 'j1', origin: pose(5, 0, 0) })],
		})

		carryJointSubtree(draft, 'missing', pose(50, 0, 0))

		expect(draft.links[0]?.origin?.x).toBe(5)
	})

	it('terminates on a parent cycle', () => {
		const draft = specWith({
			joints: [
				new Joint({ id: 'j1', parent: 'j2', origin: pose() }),
				new Joint({ id: 'j2', parent: 'j1', origin: pose() }),
			],
		})

		carryJointSubtree(draft, 'j1', pose(1, 0, 0))

		expect(draft.joints[1]?.origin?.x).toBeCloseTo(1)
	})
})
