import { BoxGeometry, Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'

import { serializeUrdf } from '../serialize-urdf'
import { parseXml, revoluteJoint, simBody, simGeom } from '../test/sim-scene-fixtures'

const attribute = (document: Document, selector: string, name: string) =>
	document.querySelector(selector)?.getAttribute(name)

describe('serializeUrdf', () => {
	it('writes a cylinder’s radius as given, not squared', () => {
		const scene = {
			bodies: [
				simBody('post', { geoms: [simGeom({ kind: 'cylinder', radius: 0.05, length: 0.4 })] }),
			],
			notes: [],
		}

		const urdf = parseXml(serializeUrdf(scene).document)

		expect(attribute(urdf, 'link[name="post"] visual cylinder', 'radius')).toBe('0.05')
		expect(attribute(urdf, 'link[name="post"] collision cylinder', 'length')).toBe('0.4')
	})

	it('writes rpy as roll about X, then pitch about Y, then yaw about Z, each about the fixed axes', () => {
		const origin = new Matrix4()
			.makeRotationZ(0.3)
			.multiply(new Matrix4().makeRotationY(0.2))
			.multiply(new Matrix4().makeRotationX(0.1))
		const scene = { bodies: [simBody('tilted', { origin })], notes: [] }

		const urdf = parseXml(serializeUrdf(scene).document)

		expect(attribute(urdf, 'joint[name="tilted_joint"] origin', 'rpy')).toBe('0.1 0.2 0.3')
	})

	it('hangs a top-level body off the world link on a fixed joint', () => {
		const scene = { bodies: [simBody('table')], notes: [] }

		const urdf = parseXml(serializeUrdf(scene).document)

		expect(attribute(urdf, 'joint[name="table_joint"]', 'type')).toBe('fixed')
		expect(attribute(urdf, 'joint[name="table_joint"] parent', 'link')).toBe('world')
	})

	it('writes a capsule as a mesh file, since URDF has no capsule', () => {
		const scene = {
			bodies: [
				simBody('pill', { geoms: [simGeom({ kind: 'capsule', radius: 0.05, length: 0.3 })] }),
			],
			notes: [],
		}

		const { document, meshes } = serializeUrdf(scene)
		const urdf = parseXml(document)

		expect(attribute(urdf, 'link[name="pill"] visual mesh', 'filename')).toBe('meshes/pill.stl')
		expect(attribute(urdf, 'link[name="pill"] collision mesh', 'filename')).toBe('meshes/pill.stl')
		expect([...meshes.keys()]).toEqual(['meshes/pill.stl'])
	})

	it('collides a mesh on a moving body as its convex hull, and says so', () => {
		const mesh = simGeom({ kind: 'mesh', geometry: new BoxGeometry() })
		const scene = {
			bodies: [simBody('elbow', { joint: revoluteJoint(0), geoms: [mesh] })],
			notes: [],
		}

		const { document, notes } = serializeUrdf(scene)
		const urdf = parseXml(document)

		expect(attribute(urdf, 'link[name="elbow"] collision mesh', 'filename')).toBe(
			'meshes/elbow_2.stl'
		)
		expect(notes).toContainEqual({ reason: 'collision-mesh-hulled', subject: 'elbow' })
	})

	it('writes a revolute joint with no finite limits as continuous, with no bounds', () => {
		const joint = { ...revoluteJoint(0), limits: undefined }
		const scene = { bodies: [simBody('wheel', { joint })], notes: [] }

		const urdf = parseXml(serializeUrdf(scene).document)

		expect(attribute(urdf, 'joint[name="wheel_joint"]', 'type')).toBe('continuous')
		expect(attribute(urdf, 'joint[name="wheel_joint"] limit', 'lower')).toBeNull()
	})

	it('keeps a small link’s inertia instead of rounding it to zero', () => {
		const scene = {
			bodies: [simBody('pin', { geoms: [simGeom({ kind: 'sphere', radius: 0.01 })] })],
			notes: [],
		}

		const urdf = parseXml(serializeUrdf(scene).document)

		expect(attribute(urdf, 'link[name="pin"] inertia', 'ixx')).toBe('1.67552e-7')
	})

	it('writes the snapshot’s joint positions beside the URDF, keyed by URDF joint name', () => {
		const scene = {
			bodies: [simBody('arm:shoulder', { joint: revoluteJoint(0.5) }), simBody('table')],
			notes: [],
		}

		const { sidecars } = serializeUrdf(scene)

		expect(sidecars.get('initial_positions.yaml')).toBe(
			'# Joint positions shown in the scene when it was exported. Radians for revolute joints, metres for prismatic.\ninitial_positions:\n  "arm:shoulder_joint": 0.5\n'
		)
	})
})
