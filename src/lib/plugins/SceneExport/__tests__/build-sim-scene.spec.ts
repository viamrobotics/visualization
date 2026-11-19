import { createWorld, type World } from 'koota'
import { Color, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import type { RawKinematicsModel } from '$lib/kinematicsTransform'

import { assertExists } from '$lib/assert'
import { relations, traits } from '$lib/ecs'
import { installWorldMatrixListeners } from '$lib/ecs/worldMatrix'
import { Pose } from '$lib/math'

import { buildSimScene } from '../build-sim-scene'

const flush = () => Promise.resolve()

const translationOf = (matrix: Matrix4) => new Vector3().setFromMatrixPosition(matrix)

describe('buildSimScene', () => {
	let world: World
	let unsubscribe: () => void

	const setup = () => {
		world = createWorld()
		unsubscribe = installWorldMatrixListeners(world)
	}

	afterEach(() => {
		unsubscribe()
		world.destroy()
	})

	const build = (kinematics: Record<string, RawKinematicsModel> = {}) =>
		buildSimScene({ world, kinematics, visualModelFor: () => undefined })

	it('places a child body relative to its parent, in metres', async () => {
		setup()
		const parent = world.spawn(traits.Name('table'), traits.Matrix(new Pose(500).toMatrix4()))
		world.spawn(
			traits.Name('cup'),
			traits.Matrix(new Pose(0, 200).toMatrix4()),
			relations.ChildOf(parent)
		)
		await flush()

		const cup = build().bodies.find((body) => body.name === 'cup')
		assertExists(cup, 'no body for the cup')
		expect(cup.parent).toBe('table')
		expect(translationOf(cup.origin).toArray()).toEqual([0, 0.2, 0])
	})

	it('sizes a box in metres and offsets it by its Center', async () => {
		setup()
		world.spawn(
			traits.Name('crate'),
			traits.Matrix(new Matrix4()),
			traits.Box({ x: 100, y: 200, z: 300 }),
			traits.Center({ x: 0, y: 0, z: 150, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)
		await flush()

		const [geom] = build().bodies[0]?.geoms ?? []
		assertExists(geom, 'the crate has no geom')
		expect(geom.shape).toEqual({ kind: 'box', size: new Vector3(0.1, 0.2, 0.3) })
		expect(translationOf(geom.origin).z).toBeCloseTo(0.15, 6)
	})

	it('skips a point cloud and hangs its children off the cloud’s parent', async () => {
		setup()
		const base = world.spawn(traits.Name('base'), traits.Matrix(new Pose(100).toMatrix4()))
		const cloud = world.spawn(
			traits.Name('cloud'),
			traits.Matrix(new Pose(0, 100).toMatrix4()),
			traits.Points,
			relations.ChildOf(base)
		)
		world.spawn(
			traits.Name('marker'),
			traits.Matrix(new Pose(0, 0, 100).toMatrix4()),
			relations.ChildOf(cloud)
		)
		await flush()

		const scene = build()
		const marker = scene.bodies.find((body) => body.name === 'marker')
		assertExists(marker, 'no body for the marker')
		expect(scene.bodies.map((body) => body.name)).not.toContain('cloud')
		expect(scene.notes).toContainEqual({ reason: 'point-cloud-skipped', subject: 'cloud' })
		expect(marker.parent).toBe('base')
		expect(
			translationOf(marker.origin)
				.toArray()
				.map((n) => +n.toFixed(6))
		).toEqual([0, 0.1, 0.1])
	})

	const TWO_LINK_ARM: RawKinematicsModel = {
		links: [
			{ id: 'base', parent: 'world' },
			{ id: 'upper', parent: 'shoulder', translation: { X: 100, Y: 0, Z: 0 } },
		],
		joints: [
			{
				id: 'shoulder',
				parent: 'base',
				type: 'revolute',
				axis: { X: 0, Y: 0, Z: 1 },
				min: -90,
				max: 90,
			},
		],
	}

	/** `TWO_LINK_ARM` as the scene draws it, with the shoulder turned 30° about Z. */
	const spawnArmAtThirtyDegrees = () => {
		const live = new Matrix4()
			.makeRotationFromQuaternion(
				new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(30))
			)
			.multiply(new Pose(100).toMatrix4())

		const arm = world.spawn(traits.Name('arm'), traits.Matrix(new Matrix4()))
		const base = world.spawn(
			traits.Name('arm:base'),
			traits.Matrix(new Matrix4()),
			relations.ChildOf(arm)
		)
		world.spawn(traits.Name('arm:upper'), traits.Matrix(live), relations.ChildOf(base))
		return { arm, endEffectorInArm: live }
	}

	it('puts a revolute joint between two links, posed at the scene’s joint angle', async () => {
		setup()
		spawnArmAtThirtyDegrees()
		await flush()

		const { bodies } = build({ arm: TWO_LINK_ARM })
		const shoulder = bodies.find((body) => body.name === 'arm:shoulder')
		const upper = bodies.find((body) => body.name === 'arm:upper')
		assertExists(shoulder, 'no body for the shoulder joint')
		assertExists(shoulder.joint, 'the shoulder body is welded')
		assertExists(upper, 'no body for the upper link')

		expect(shoulder.parent).toBe('arm:base')
		expect(shoulder.joint.value).toBeCloseTo(0.523599, 6)
		expect(shoulder.joint.lower).toBeCloseTo(-1.570796, 6)
		expect(upper.parent).toBe('arm:shoulder')
		expect(translationOf(upper.origin).x).toBeCloseTo(0.1, 6)
		expect(bodies.indexOf(shoulder)).toBeLessThan(bodies.indexOf(upper))
	})

	it.each([
		{ state: 'polled through the arm', isPolled: true },
		{ state: 'at its config pose, before any poll', isPolled: false },
	])('mounts a frame parented to an arm on its end effector when $state', async ({ isPolled }) => {
		setup()
		const { arm, endEffectorInArm } = spawnArmAtThirtyDegrees()
		const offset = new Pose(0, 0, 50).toMatrix4()
		const live = isPolled ? endEffectorInArm.clone().multiply(offset) : offset.clone()
		world.spawn(
			traits.Name('gripper'),
			traits.Matrix(offset),
			traits.LiveMatrix(live),
			relations.ChildOf(arm)
		)
		await flush()

		const gripper = build({ arm: TWO_LINK_ARM }).bodies.find((body) => body.name === 'gripper')
		assertExists(gripper, 'no body for the gripper')

		expect(gripper.parent).toBe('arm:upper')
		expect(
			translationOf(gripper.origin)
				.toArray()
				.map((n) => +n.toFixed(6))
		).toEqual([0, 0, 0.05])
	})

	const ARM_ENDING_IN_A_WRIST_JOINT: RawKinematicsModel = {
		...TWO_LINK_ARM,
		joints: [
			...(TWO_LINK_ARM.joints ?? []),
			{
				id: 'wrist',
				parent: 'upper',
				type: 'revolute',
				axis: { X: 1, Y: 0, Z: 0 },
				min: -180,
				max: 180,
			},
		],
	}

	/** A gripper 50 mm out along X from the wrist, its scene pose either polled through the arm or not. */
	const spawnGripperOnWrist = (isPolled: boolean) => {
		const { arm, endEffectorInArm } = spawnArmAtThirtyDegrees()
		const offset = new Pose(50).toMatrix4()
		const wristTurn = new Matrix4().makeRotationX(MathUtils.degToRad(20))
		const live = isPolled
			? endEffectorInArm.clone().multiply(wristTurn).multiply(offset)
			: offset.clone()
		world.spawn(
			traits.Name('gripper'),
			traits.Matrix(offset),
			traits.LiveMatrix(live),
			relations.ChildOf(arm)
		)
	}

	it('mounts a frame on an end-effector joint, at the angle its polled pose shows', async () => {
		setup()
		spawnGripperOnWrist(true)
		await flush()

		const { bodies } = build({ arm: ARM_ENDING_IN_A_WRIST_JOINT })
		const wrist = bodies.find((body) => body.name === 'arm:wrist')
		const gripper = bodies.find((body) => body.name === 'gripper')
		assertExists(wrist?.joint, 'no wrist joint body')
		assertExists(gripper, 'no body for the gripper')

		expect(wrist.parent).toBe('arm:upper')
		expect(wrist.joint.value).toBeCloseTo(0.349066, 6)
		expect(gripper.parent).toBe('arm:wrist')
		expect(translationOf(gripper.origin).x).toBeCloseTo(0.05, 6)
	})

	it('leaves an end-effector joint at zero and says so when no pose was measured through it', async () => {
		setup()
		spawnGripperOnWrist(false)
		await flush()

		const { bodies, notes } = build({ arm: ARM_ENDING_IN_A_WRIST_JOINT })
		const wrist = bodies.find((body) => body.name === 'arm:wrist')
		assertExists(wrist?.joint, 'no wrist joint body')

		expect(wrist.joint.value).toBe(0)
		expect(notes).toContainEqual({ reason: 'joint-value-unknown', subject: 'arm:wrist' })
	})

	it('refuses a joint angle when the link also moved in a way the joint cannot', async () => {
		setup()
		const arm = world.spawn(traits.Name('arm'), traits.Matrix(new Matrix4()))
		const base = world.spawn(
			traits.Name('arm:base'),
			traits.Matrix(new Matrix4()),
			relations.ChildOf(arm)
		)
		world.spawn(
			traits.Name('arm:upper'),
			traits.Matrix(new Pose(100, 0, 40).toMatrix4()),
			relations.ChildOf(base)
		)
		await flush()

		const { bodies, notes } = build({ arm: TWO_LINK_ARM })
		const shoulder = bodies.find((body) => body.name === 'arm:shoulder')
		assertExists(shoulder?.joint, 'no shoulder joint body')

		expect(shoulder.joint.value).toBe(0)
		expect(notes).toContainEqual({ reason: 'joint-value-unknown', subject: 'arm:upper' })
	})

	it('exports an open cylinder as a tube mesh rather than a solid one', async () => {
		setup()
		world.spawn(
			traits.Name('sleeve'),
			traits.Matrix(new Matrix4()),
			traits.Cylinder({ r: 50, l: 200, capped: false })
		)
		await flush()

		const shape = build().bodies[0]?.geoms[0]?.shape
		assertExists(shape, 'the sleeve has no geom')
		expect(shape.kind).toBe('mesh')
	})

	it('writes the color the scene shows as sRGB, not three’s linear value', async () => {
		setup()
		const linear = new Color('#ff8000')
		world.spawn(
			traits.Name('ball'),
			traits.Matrix(new Matrix4()),
			traits.Sphere({ r: 10 }),
			traits.Color({ r: linear.r, g: linear.g, b: linear.b }),
			traits.Opacity(0.5)
		)
		await flush()

		const rgba = build().bodies[0]?.geoms[0]?.rgba
		assertExists(rgba, 'the ball has no geom')
		expect(rgba[0]).toBeCloseTo(1, 6)
		expect(rgba[1]).toBeCloseTo(0.501961, 3)
		expect(rgba[3]).toBe(0.5)
	})
})
