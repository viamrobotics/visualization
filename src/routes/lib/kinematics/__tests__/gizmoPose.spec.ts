import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'

import { Pose, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { Joint, JointType, KinematicsSpec, Link } from '$lib/buf/kinematics/v1/spec_pb'
import { Pose as PoseMath } from '$lib/math/pose'

import type { PlaceableItem } from '../gizmoPose'

import { dragPreviewMatrix, gizmoToAssembly, gizmoWorldMatrix } from '../gizmoPose'

const matrixOf = (pose: Partial<Pose>): Matrix4 =>
	new PoseMath().copy({ oZ: 1, ...pose }).toMatrix4()

const frame = (name: string, parent: string, matrix: Matrix4): Transform => {
	const { x, y, z, oX, oY, oZ, theta } = new PoseMath().setFromMatrix4(matrix)
	return new Transform({
		referenceFrame: name,
		poseInObserverFrame: new PoseInFrame({
			referenceFrame: parent,
			pose: new Pose({ x, y, z, oX, oY, oZ, theta }),
		}),
	})
}

const expectMatricesClose = (actual: Matrix4 | undefined, expected: Matrix4) => {
	expect(actual).toBeDefined()
	for (let index = 0; index < 16; index += 1) {
		expect(actual!.elements[index]).toBeCloseTo(expected.elements[index], 5)
	}
}

const HINGE_ORIGIN = { x: 100, y: 20, z: 50, oX: 0, oY: 0, oZ: 1, theta: 40 }
const ARM_ORIGIN = { x: 160, y: 30, z: 80, oX: 0, oY: 1, oZ: 0, theta: 25 }
const TCP_POSE = { x: 200, y: 60, z: 90, oX: 1, oY: 0, oZ: 0, theta: 15 }

const link = new Link({ id: 'base', parent: '', origin: new Pose({ x: 10, y: 20, z: 30, oZ: 1 }) })
const arm = new Link({ id: 'arm', parent: 'hinge', origin: new Pose(ARM_ORIGIN) })
const hinge = (type = JointType.REVOLUTE) =>
	new Joint({ id: 'hinge', type, parent: '', origin: new Pose(HINGE_ORIGIN) })

const buildSpec = (armOrigin: Partial<Pose> = ARM_ORIGIN, jointType = JointType.REVOLUTE) =>
	new KinematicsSpec({
		name: 'tool',
		links: [link, new Link({ id: 'arm', parent: 'hinge', origin: new Pose(armOrigin) })],
		joints: [hinge(jointType)],
		tcpParent: 'hinge',
		tcpPose: new Pose(TCP_POSE),
	})

/** The frame tree the server sends: the joint's pose includes `motion`, links sit at their local origin. */
const buildTransforms = (spec: KinematicsSpec, motion: Matrix4): Transform[] => {
	const hingeWorld = matrixOf(HINGE_ORIGIN).multiply(motion)
	return [
		frame('root', 'world', new Matrix4()),
		frame('base', 'root', matrixOf({ x: 10, y: 20, z: 30 })),
		frame('hinge', 'root', hingeWorld),
		frame(
			'arm',
			'hinge',
			matrixOf(HINGE_ORIGIN)
				.invert()
				.multiply(matrixOf(spec.links[1].origin ?? {}))
		),
	]
}

const spec = buildSpec()
const revoluteAt30 = matrixOf({ theta: 30 })
const posed = buildTransforms(spec, revoluteAt30)
const armItem: PlaceableItem = { kind: 'link', link: arm }
const baseItem: PlaceableItem = { kind: 'link', link }
const hingeItem: PlaceableItem = { kind: 'joint', joint: hinge() }
const tcpItem: PlaceableItem = { kind: 'tcp' }

describe('gizmoWorldMatrix', () => {
	it('places a link under root at its own origin', () => {
		expectMatricesClose(gizmoWorldMatrix(spec, posed, baseItem), matrixOf({ x: 10, y: 20, z: 30 }))
	})

	it('places a joint at its origin without its own motion', () => {
		const prismatic = buildSpec(ARM_ORIGIN, JointType.PRISMATIC)
		const slid = buildTransforms(prismatic, matrixOf({ z: 50 }))
		const prismaticItem: PlaceableItem = { kind: 'joint', joint: hinge(JointType.PRISMATIC) }
		expectMatricesClose(gizmoWorldMatrix(prismatic, slid, prismaticItem), matrixOf(HINGE_ORIGIN))
	})

	it('places a link under a posed joint with the joint motion applied', () => {
		const expected = matrixOf(HINGE_ORIGIN)
			.multiply(revoluteAt30)
			.multiply(matrixOf(HINGE_ORIGIN).invert().multiply(matrixOf(ARM_ORIGIN)))
		expectMatricesClose(gizmoWorldMatrix(spec, posed, armItem), expected)
	})

	it('returns undefined while the parent frame is missing', () => {
		expect(gizmoWorldMatrix(spec, [], armItem)).toBeUndefined()
		expect(gizmoToAssembly(spec, [], armItem, new Matrix4())).toBeUndefined()
	})
})

describe('gizmoToAssembly', () => {
	it.each([
		['a link', baseItem],
		['a posed-joint link', armItem],
		['a joint', hingeItem],
		['the TCP', tcpItem],
	])('round-trips %s through gizmoWorldMatrix', (_label, item) => {
		const world = gizmoWorldMatrix(spec, posed, item)!
		const pose = gizmoToAssembly(spec, posed, item, world.clone())
		expect(pose).toBeDefined()
		const expected =
			item.kind === 'link'
				? item.link.origin
				: item.kind === 'joint'
					? item.joint.origin
					: spec.tcpPose
		expectMatricesClose(matrixOf(pose!), matrixOf(expected ?? {}))
	})

	it('lands a link under a posed joint where it was dropped, and at zero under the joint origin', () => {
		const dropped = matrixOf({ x: 400, y: -120, z: 260, oX: 0, oY: 1, oZ: 0, theta: 70 })
		const pose = gizmoToAssembly(spec, posed, armItem, dropped.clone())!

		const written = buildSpec(pose)
		const writtenItem: PlaceableItem = { kind: 'link', link: written.links[1] }
		expectMatricesClose(
			gizmoWorldMatrix(written, buildTransforms(written, revoluteAt30), writtenItem),
			dropped
		)

		const atZero = buildTransforms(written, new Matrix4())
		const local = matrixOf(HINGE_ORIGIN).invert().multiply(matrixOf(pose))
		expectMatricesClose(
			gizmoWorldMatrix(written, atZero, writtenItem),
			matrixOf(HINGE_ORIGIN).multiply(local)
		)
		expect(Math.abs(pose.x - dropped.elements[12] * 1000)).toBeGreaterThan(1)
	})
})

describe('dragPreviewMatrix', () => {
	const translateX = (metres: number, matrix: Matrix4) =>
		new Matrix4().makeTranslation(metres, 0, 0).multiply(matrix)

	it('shifts a link under root by the drag', () => {
		const dragStart = gizmoWorldMatrix(spec, posed, baseItem)!

		const preview = dragPreviewMatrix(spec, posed, baseItem, dragStart, translateX(0.1, dragStart))

		expectMatricesClose(preview, matrixOf({ x: 110, y: 20, z: 30 }))
	})

	it('previews a link under a posed joint where its release lands', () => {
		const dragStart = gizmoWorldMatrix(spec, posed, armItem)!
		const dragNow = matrixOf({ x: 400, y: -120, z: 260, oX: 0, oY: 1, oZ: 0, theta: 70 })

		const preview = dragPreviewMatrix(spec, posed, armItem, dragStart, dragNow)!

		const hingeWorld = matrixOf(HINGE_ORIGIN).multiply(revoluteAt30)
		expectMatricesClose(hingeWorld.multiply(preview), dragNow)
	})

	it('keeps the motion of a posed joint while dragging it', () => {
		const prismatic = buildSpec(ARM_ORIGIN, JointType.PRISMATIC)
		const slid = buildTransforms(prismatic, matrixOf({ z: 50 }))
		const prismaticItem: PlaceableItem = { kind: 'joint', joint: hinge(JointType.PRISMATIC) }
		const dragStart = gizmoWorldMatrix(prismatic, slid, prismaticItem)!

		const preview = dragPreviewMatrix(
			prismatic,
			slid,
			prismaticItem,
			dragStart,
			translateX(0.1, dragStart)
		)!

		expect(preview.elements[12]).toBeCloseTo(0.2, 5)
		expect(preview.elements[13]).toBeCloseTo(0.02, 5)
		expect(preview.elements[14]).toBeCloseTo(0.1, 5)
	})

	it('returns undefined while the item has no frame', () => {
		expect(dragPreviewMatrix(spec, [], baseItem, new Matrix4(), new Matrix4())).toBeUndefined()
	})
})
