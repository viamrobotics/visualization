import { type PartialMessage, Struct } from '@bufbuild/protobuf'
import { commonApi, robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { kinematicModelToJson, partKinematicsJson } from '../kinematicModelJson'

const revolute = (overrides: PartialMessage<commonApi.KinematicJoint> = {}) =>
	new commonApi.KinematicJoint({
		id: 'j1',
		parent: 'base',
		type: commonApi.JointType.REVOLUTE,
		axis: { x: 0, y: 0, z: 1 },
		...overrides,
	})

describe('kinematicModelToJson', () => {
	it('writes a link as rdk writes LinkConfig: translation, orientation, and its collision geometry', () => {
		const model = new commonApi.KinematicModel({
			name: 'arm',
			links: [
				new commonApi.KinematicLink({
					id: 'base',
					pose: {
						translation: { x: 10, y: 20, z: 30 },
						orientation: {
							case: 'orientationVector',
							value: { oX: 0, oY: 1, oZ: 0, theta: 90 },
						},
					},
					collision: [
						new commonApi.Geometry({
							label: 'base-box',
							center: { x: 1, y: 2, z: 3, oX: 0, oY: 0, oZ: 1, theta: 0 },
							geometryType: { case: 'box', value: { dimsMm: { x: 4, y: 5, z: 6 } } },
						}),
					],
				}),
			],
		})

		expect(kinematicModelToJson(model).links).toEqual([
			{
				id: 'base',
				translation: { X: 10, Y: 20, Z: 30 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 1, z: 0, th: 90 } },
				geometry: {
					Label: 'base-box',
					translation: { X: 1, Y: 2, Z: 3 },
					type: 'box',
					x: 4,
					y: 5,
					z: 6,
				},
			},
		])
	})

	it('writes euler angles in radians, as rdk marshals them', () => {
		const model = new commonApi.KinematicModel({
			links: [
				new commonApi.KinematicLink({
					id: 'base',
					pose: { orientation: { case: 'eulerAngles', value: { roll: 90, pitch: 0, yaw: 180 } } },
				}),
			],
		})

		expect(kinematicModelToJson(model).links?.[0]?.orientation).toEqual({
			type: 'euler_angles',
			value: { roll: Math.PI / 2, pitch: 0, yaw: Math.PI },
		})
	})

	it('keeps a revolute joint’s axis and limits', () => {
		const model = new commonApi.KinematicModel({
			joints: [revolute({ limits: { min: -180, max: 180, maxVelocity: 90 } })],
		})

		expect(kinematicModelToJson(model).joints).toEqual([
			{
				id: 'j1',
				parent: 'base',
				type: 'revolute',
				axis: { X: 0, Y: 0, Z: 1 },
				min: -180,
				max: 180,
				max_velocity: 90,
			},
		])
	})

	it('writes a continuous joint as an unbounded revolute one, as rdk’s URDF reader does', () => {
		const model = new commonApi.KinematicModel({
			joints: [revolute({ type: commonApi.JointType.CONTINUOUS })],
		})

		expect(kinematicModelToJson(model).joints?.[0]).toEqual({
			id: 'j1',
			parent: 'base',
			type: 'revolute',
			axis: { X: 0, Y: 0, Z: 1 },
		})
	})

	it('gives a mimic joint its source and leaves its limits out', () => {
		const model = new commonApi.KinematicModel({
			joints: [
				revolute({
					mimic: { joint: 'j0', multiplier: -1, offset: 5 },
					limits: { min: -10, max: 10 },
				}),
			],
		})

		const [joint] = kinematicModelToJson(model).joints ?? []

		expect(joint?.mimic).toEqual({ joint: 'j0', multiplier: -1, offset: 5 })
		expect(joint?.min, 'rdk reads a mimic joint’s bounds off its source').toBeUndefined()
	})
})

describe('partKinematicsJson', () => {
	it('prefers the typed model over the deprecated struct', () => {
		const part = new robotApi.FrameSystemConfig({
			kinematics: Struct.fromJson({ kinematic_param_type: 'DH', dhParams: [{ id: 'l1' }] }),
			model: new commonApi.KinematicModel({ name: 'from-model', joints: [revolute()] }),
		})

		expect(partKinematicsJson(part)?.name).toBe('from-model')
	})

	it('falls back to the deprecated struct from a server that sends no typed model', () => {
		const part = new robotApi.FrameSystemConfig({
			kinematics: Struct.fromJson({ name: 'from-struct', links: [{ id: 'base' }] }),
		})

		expect(partKinematicsJson(part)?.name).toBe('from-struct')
	})
})
