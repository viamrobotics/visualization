import { BufferGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import { serializeMjcf } from '../serialize-mjcf'
import { parseXml, revoluteJoint, simBody, simGeom } from '../test/sim-scene-fixtures'

const attribute = (document: Document, selector: string, name: string) =>
	document.querySelector(selector)?.getAttribute(name)

describe('serializeMjcf', () => {
	it('keys the snapshot pose in the order MuJoCo lays out qpos, depth first', () => {
		const scene = {
			bodies: [
				simBody('shoulder', { joint: revoluteJoint(0.1) }),
				simBody('elbow', { parent: 'shoulder', joint: revoluteJoint(0.2) }),
				simBody('gripper', { joint: revoluteJoint(0.3) }),
			],
			notes: [],
		}

		const mjcf = parseXml(serializeMjcf(scene).document)

		expect(attribute(mjcf, 'keyframe key', 'qpos')).toBe('0.1 0.2 0.3')
		expect(mjcf.querySelector('body[name="shoulder"] > body[name="elbow"]')?.tagName).toBe('body')
	})

	it('writes a capsule natively, sized by radius and half its straight section', () => {
		const scene = {
			bodies: [
				simBody('pill', { geoms: [simGeom({ kind: 'capsule', radius: 0.05, length: 0.3 })] }),
			],
			notes: [],
		}

		const mjcf = parseXml(serializeMjcf(scene).document)

		expect(attribute(mjcf, 'body[name="pill"] geom', 'type')).toBe('capsule')
		expect(attribute(mjcf, 'body[name="pill"] geom', 'size')).toBe('0.05 0.1')
	})

	it('writes quat scalar first', () => {
		const origin = new Matrix4().makeRotationZ(Math.PI / 2)
		const scene = { bodies: [simBody('turned', { origin })], notes: [] }

		const mjcf = parseXml(serializeMjcf(scene).document)

		expect(attribute(mjcf, 'body[name="turned"]', 'quat')).toBe('0.707107 0 0 0.707107')
	})

	it('keeps visual-only geoms out of collisions and out of the body’s mass', () => {
		const scene = {
			bodies: [
				simBody('model', {
					geoms: [simGeom({ kind: 'sphere', radius: 0.1 }, { role: 'visual' })],
				}),
			],
			notes: [],
		}

		const mjcf = parseXml(serializeMjcf(scene).document)

		expect(attribute(mjcf, 'body[name="model"] geom', 'contype')).toBe('0')
		expect(attribute(mjcf, 'body[name="model"] geom', 'density')).toBe('0')
	})

	it('draws a flat collision mesh without colliding it, since MuJoCo cannot hull it', () => {
		const plate = simGeom({ kind: 'mesh', geometry: new PlaneGeometry(1, 1) })
		const scene = { bodies: [simBody('plate', { geoms: [plate] })], notes: [] }

		const { document, notes } = serializeMjcf(scene)
		const mjcf = parseXml(document)

		expect(attribute(mjcf, 'body[name="plate"] geom', 'contype')).toBe('0')
		expect(notes).toContainEqual({ reason: 'mujoco-flat-mesh-visual-only', subject: 'plate' })
	})

	it('leaves out a mesh with fewer than 4 vertices, which MuJoCo refuses in any role', () => {
		const triangle = new BufferGeometry().setAttribute(
			'position',
			new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
		)
		const scene = {
			bodies: [
				simBody('shard', {
					geoms: [simGeom({ kind: 'mesh', geometry: triangle }, { role: 'visual' })],
				}),
			],
			notes: [],
		}

		const { document, meshes, notes } = serializeMjcf(scene)
		const mjcf = parseXml(document)

		expect(mjcf.querySelector('body[name="shard"] geom')).toBeNull()
		expect(meshes.size).toBe(0)
		expect(notes).toContainEqual({ reason: 'mujoco-mesh-too-few-vertices', subject: 'shard' })
	})
})
