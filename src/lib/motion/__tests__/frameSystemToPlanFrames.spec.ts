import { Struct } from '@bufbuild/protobuf'
import { commonApi, Geometry, PoseInFrame, robotApi, Sphere, Transform } from '@viamrobotics/sdk'
import { describe, expect, it, vi } from 'vitest'

import { Geometry as LocalGeometry } from '$lib/buf/common/v1/common_pb'
import { Pose } from '$lib/math'
import { parsePlan } from '$lib/plugins/MotionPlanReplayer/parse-plan'

import type { FrameDescriptor } from '../frameDescriptors'

import planJson from '../../plugins/MotionPlanReplayer/__tests__/__fixtures__/plan.json?raw'
import { buildFrameDescriptors, DECODED_FRAME_TYPE } from '../frameDescriptors'
import { frameSystemToPlanFrames } from '../frameSystemToPlanFrames'

const dump = parsePlan(planJson)

/**
 * The dump's `model` frame holds the exact `ModelConfigJSON` `kinematics` carries, which is what
 * makes the comparisons below equivalence tests rather than restatements.
 */
const kinematicsFromDump = (partName: string): Struct => {
	const entry = dump.frames[partName]
	if (!entry || entry.frame_type !== 'model') {
		throw new Error(`fixture has no model frame named "${partName}"`)
	}
	const model = (entry.frame as { model: Record<string, unknown> }).model
	return Struct.fromJson(model as never)
}

const part = (options: {
	name: string
	parent?: string
	pose?: {
		x?: number
		y?: number
		z?: number
		oX?: number
		oY?: number
		oZ?: number
		theta?: number
	}
	kinematics?: Struct
	geometry?: Geometry
}): robotApi.FrameSystemConfig =>
	new robotApi.FrameSystemConfig({
		frame: new Transform({
			referenceFrame: options.name,
			poseInObserverFrame: new PoseInFrame({
				referenceFrame: options.parent ?? 'world',
				pose: { x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0, ...options.pose },
			}),
			physicalObject: options.geometry,
		}),
		kinematics: options.kinematics,
	})

const byName = (descriptors: FrameDescriptor[]) =>
	new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))

describe('parenting', () => {
	it('splits a part into a `_origin` mount and the part frame itself', () => {
		const { frames, parents } = frameSystemToPlanFrames([part({ name: 'cam', parent: 'table' })])

		expect(parents['cam_origin']).toBe('table')
		expect(parents['cam']).toBe('cam_origin')
		expect(Object.keys(frames).toSorted()).toEqual(['cam', 'cam_origin'])
	})

	it('defaults a part with no stated parent to the world root', () => {
		const parts = [
			new robotApi.FrameSystemConfig({ frame: new Transform({ referenceFrame: 'a' }) }),
		]
		expect(frameSystemToPlanFrames(parts).parents['a_origin']).toBe('world')
	})

	it('ignores a part named `world`, which has no offset of its own', () => {
		expect(frameSystemToPlanFrames([part({ name: 'world' })]).frames).toEqual({})
	})

	it('ignores a config with no frame at all', () => {
		expect(frameSystemToPlanFrames([new robotApi.FrameSystemConfig({})]).frames).toEqual({})
	})

	it('ignores a part whose frame name is empty', () => {
		const parts = [new robotApi.FrameSystemConfig({ frame: new Transform({ referenceFrame: '' }) })]
		expect(frameSystemToPlanFrames(parts).frames).toEqual({})
	})

	it('roots a part at the world when its stated parent is the empty string', () => {
		const parts = [
			new robotApi.FrameSystemConfig({
				frame: new Transform({
					referenceFrame: 'a',
					poseInObserverFrame: new PoseInFrame({ referenceFrame: '' }),
				}),
			}),
		]
		expect(frameSystemToPlanFrames(parts).parents['a_origin']).toBe('world')
	})
})

describe('the mount offset', () => {
	const pose = { x: 10, y: -20, z: 30, oX: 0, oY: 1, oZ: 0, theta: 90 }

	it("carries the part's pose on its `_origin`", () => {
		const { frames } = frameSystemToPlanFrames([part({ name: 'cam', parent: 'table', pose })])
		const { pose: carried } = frames['cam_origin']!.frame as { pose: Pose }

		expect([carried.x, carried.y, carried.z]).toEqual([10, -20, 30])
		expect([carried.oX, carried.oY, carried.oZ, carried.theta]).toEqual([0, 1, 0, 90])
	})

	it("survives the descriptor builder onto the frame's local pose", () => {
		const descriptors = byName(
			buildFrameDescriptors(frameSystemToPlanFrames([part({ name: 'cam', pose })]))
		)

		const origin = descriptors.get('cam_origin')
		expect(origin?.kind === 'static' && origin.localPose.x).toBe(10)
		expect(origin?.kind === 'static' && origin.localPose.theta).toBe(90)
	})

	// Duplicating the offset here would apply it twice: it belongs to the origin above.
	it('leaves the bare part frame at identity', () => {
		const { frames } = frameSystemToPlanFrames([part({ name: 'cam', pose })])
		const { pose: bare } = frames['cam']!.frame as { pose: Pose }

		expect([bare.x, bare.y, bare.z, bare.theta]).toEqual([0, 0, 0, 0])
	})
})

describe("a part named after another part's generated origin", () => {
	const sphere = new Geometry({
		geometryType: { case: 'sphere', value: new Sphere({ radiusMm: 12 }) },
		label: 'cam-body',
	})

	// `cam` is listed first on purpose: array order decides which part claims `frames['cam_origin']`.
	it("keeps the earlier part's mount offset and geometry, and warns and skips the collider", () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		const { frames, parents } = frameSystemToPlanFrames([
			part({ name: 'cam', parent: 'table', geometry: sphere }),
			part({ name: 'cam_origin', parent: 'table' }),
		])

		expect(parents['cam_origin']).toBe('table')
		const { geometry: carried } = frames['cam_origin']!.frame as { geometry: LocalGeometry | null }
		expect(carried?.geometryType.case).toBe('sphere')

		expect(frames['cam_origin_origin']).toBeUndefined()

		expect(warn).toHaveBeenCalledWith(expect.stringContaining('cam_origin'))
		warn.mockRestore()
	})
})

describe('geometry placement', () => {
	const sphere = new Geometry({
		geometryType: { case: 'sphere', value: new Sphere({ radiusMm: 12 }) },
		label: 'blob',
	})

	it("hangs a model-less part's geometry on its `_origin`, matching RDK", () => {
		const descriptors = byName(
			buildFrameDescriptors(frameSystemToPlanFrames([part({ name: 'blob', geometry: sphere })]))
		)

		const origin = descriptors.get('blob_origin')
		expect(origin?.kind).toBe('static')
		expect(origin?.kind === 'static' && origin.geometry?.geometryType.case).toBe('sphere')

		const bare = descriptors.get('blob')
		expect(bare?.kind === 'static' && bare.geometry).toBeNull()
	})

	it("hangs a modelled part's geometry on its `_origin` too, matching RDK", () => {
		const descriptors = byName(
			buildFrameDescriptors(
				frameSystemToPlanFrames([
					part({ name: 'left-arm', kinematics: kinematicsFromDump('left-arm'), geometry: sphere }),
				])
			)
		)

		const origin = descriptors.get('left-arm_origin')
		expect(origin?.kind === 'static' && origin.geometry?.geometryType.case).toBe('sphere')
	})

	it('leaves the origin bare when the part configured no geometry', () => {
		const descriptors = byName(
			buildFrameDescriptors(
				frameSystemToPlanFrames([
					part({ name: 'left-arm', kinematics: kinematicsFromDump('left-arm') }),
				])
			)
		)

		const origin = descriptors.get('left-arm_origin')
		expect(origin?.kind === 'static' && origin.geometry).toBeNull()
	})
})

describe('a jointless model whose part configured a geometry', () => {
	const linksOnly = Struct.fromJson({
		name: 'grip',
		kinematic_param_type: 'SVA',
		links: [
			{
				id: 'body',
				parent: 'world',
				translation: { X: 0, Y: 0, Z: 40 },
				geometry: { x: 5, y: 5, z: 5, type: 'box' },
			},
		],
		joints: [],
	} as never)

	const envelope = new Geometry({
		geometryType: { case: 'sphere', value: new Sphere({ radiusMm: 80 }) },
		label: 'envelope',
	})

	const descriptors = byName(
		buildFrameDescriptors(
			frameSystemToPlanFrames([part({ name: 'grip', kinematics: linksOnly, geometry: envelope })])
		)
	)

	it("draws the configured shape and none of the model's links", () => {
		const origin = descriptors.get('grip_origin')
		expect(origin?.kind === 'static' && origin.geometry?.geometryType.case).toBe('sphere')
		expect(descriptors.has('grip:body')).toBe(false)
	})

	it('still publishes the bare part frame for descendants to hang off', () => {
		expect(descriptors.get('grip')?.kind).toBe('static')
	})

	// Repeating it here and on `grip_origin` is the doubling this branch exists to prevent.
	it('does not repeat the envelope on the stand-in frame', () => {
		const bare = descriptors.get('grip')
		expect(bare?.kind === 'static' && bare.geometry).toBeNull()
	})

	it('keeps the links when the part configured nothing', () => {
		const bare = byName(
			buildFrameDescriptors(
				frameSystemToPlanFrames([part({ name: 'grip', kinematics: linksOnly })])
			)
		)

		expect(bare.has('grip:body')).toBe(true)
	})
})

/**
 * Compares the synthesis only: both sides run through `buildFrameDescriptors`, so a deterministic
 * mistake there cancels out. Reversing the joint walk's sibling sort passes every assertion here.
 */
describe('equivalence with a real plan dump', () => {
	const dumpDescriptors = byName(buildFrameDescriptors(dump))
	const synthesized = byName(
		buildFrameDescriptors(
			frameSystemToPlanFrames([
				part({ name: 'left-arm', kinematics: kinematicsFromDump('left-arm') }),
			])
		)
	)

	const armFrames = [...dumpDescriptors.keys()].filter((name) => name.startsWith('left-arm:'))

	it('reproduces every frame of the arm the dump contains', () => {
		expect(armFrames.length).toBeGreaterThan(10)
		expect(
			[...synthesized.keys()].filter((name) => name.startsWith('left-arm:')).toSorted()
		).toEqual(armFrames.toSorted())
	})

	it.each(['left-arm:base', 'left-arm:base_top', 'left-arm:upper_arm', 'left-arm:wrist_link'])(
		'places the static link %s identically',
		(name) => {
			const expected = dumpDescriptors.get(name)
			const actual = synthesized.get(name)

			expect(actual?.kind).toBe('static')
			expect(actual?.parent).toBe(expected?.parent)
			expect(actual?.kind === 'static' && actual.localPose).toEqual(
				expected?.kind === 'static' ? expected.localPose : undefined
			)
			expect(actual?.kind === 'static' && actual.geometry?.geometryType.case).toEqual(
				expected?.kind === 'static' ? expected.geometry?.geometryType.case : undefined
			)
		}
	)

	it.each(['left-arm:waist', 'left-arm:shoulder', 'left-arm:elbow', 'left-arm:wrist'])(
		'drives the joint %s from the same trajectory column',
		(name) => {
			const expected = dumpDescriptors.get(name)
			const actual = synthesized.get(name)

			expect(actual?.kind).toBe('joint')
			expect(actual?.parent).toBe(expected?.parent)
			expect(actual?.kind === 'joint' && actual.motion).toBe(
				expected?.kind === 'joint' ? expected.motion : undefined
			)
			expect(actual?.kind === 'joint' && actual.jointIndex).toBe(
				expected?.kind === 'joint' ? expected.jointIndex : undefined
			)
			expect(actual?.kind === 'joint' && actual.componentName).toBe('left-arm')
		}
	)

	// A link naming `world` inside a model means the model's own mount, not the scene root.
	it("roots the arm at the part's own mount rather than the scene root", () => {
		expect(synthesized.get('left-arm:base')?.parent).toBe('left-arm_origin')
	})

	it("remaps a part parented to the arm onto the arm's end effector", () => {
		const withCamera = byName(
			buildFrameDescriptors(
				frameSystemToPlanFrames([
					part({ name: 'left-arm', kinematics: kinematicsFromDump('left-arm') }),
					part({ name: 'left-cam', parent: 'left-arm' }),
				])
			)
		)

		expect(withCamera.get('left-cam_origin')?.parent).toBe(
			dumpDescriptors.get('left-cam_origin')?.parent
		)
		expect(withCamera.get('left-cam_origin')?.parent).toMatch(/^left-arm:/)
	})
})

/**
 * The same claim with the descriptor builder taken out of it: the frame system this file synthesizes
 * is compared to the one RDK dumped, directly. Nothing downstream can cancel a mistake here.
 */
describe('the synthesized frame system itself', () => {
	const armParentsIn = (parents: Record<string, string>) =>
		Object.fromEntries(Object.entries(parents).filter(([child]) => child.startsWith('left-arm')))

	const armFramesIn = (frames: Record<string, unknown>) =>
		Object.keys(frames)
			.filter((name) => name.startsWith('left-arm'))
			.toSorted()

	const synthesized = frameSystemToPlanFrames([
		part({ name: 'left-arm', kinematics: kinematicsFromDump('left-arm') }),
	])

	it('parents every frame exactly as the dump does', () => {
		expect(armParentsIn(synthesized.parents)).toEqual(armParentsIn(dump.parents))
	})

	it('publishes the same set of frame names', () => {
		expect(armFramesIn(synthesized.frames)).toEqual(armFramesIn(dump.frames))
	})
})

/**
 * Named so the orderings disagree: declaration and a reversed sibling sort give `[zeta, alpha]`,
 * RDK's alphabetical walk gives `[alpha, zeta]`. Every other fixture is a serial chain.
 */
describe('a model that branches', () => {
	const branched = Struct.fromJson({
		name: 'grip',
		kinematic_param_type: 'SVA',
		links: [
			{ id: 'base', parent: 'world', translation: { X: 0, Y: 0, Z: 0 } },
			{ id: 'zeta_finger', parent: 'zeta_joint', translation: { X: 0, Y: 0, Z: 30 } },
			{ id: 'alpha_finger', parent: 'alpha_joint', translation: { X: 0, Y: 0, Z: 30 } },
		],
		joints: [
			{
				id: 'zeta_joint',
				type: 'revolute',
				parent: 'base',
				axis: { X: 0, Y: 0, Z: 1 },
				min: -90,
				max: 90,
			},
			{
				id: 'alpha_joint',
				type: 'revolute',
				parent: 'base',
				axis: { X: 0, Y: 0, Z: 1 },
				min: -90,
				max: 90,
			},
		],
	} as never)

	const columnOf = (kinematics: Struct, joint: string) => {
		const descriptors = byName(
			buildFrameDescriptors(frameSystemToPlanFrames([part({ name: 'grip', kinematics })]))
		)
		const descriptor = descriptors.get(`grip:${joint}`)
		return descriptor?.kind === 'joint' ? descriptor.jointIndex : undefined
	}

	it('numbers the branch alphabetically, not in the order it was declared', () => {
		expect(columnOf(branched, 'alpha_joint')).toBe(0)
		expect(columnOf(branched, 'zeta_joint')).toBe(1)
	})

	it('gives the same columns however the config lists them', () => {
		const shuffled = Struct.fromJson({
			name: 'grip',
			kinematic_param_type: 'SVA',
			links: [
				{ id: 'alpha_finger', parent: 'alpha_joint', translation: { X: 0, Y: 0, Z: 30 } },
				{ id: 'zeta_finger', parent: 'zeta_joint', translation: { X: 0, Y: 0, Z: 30 } },
				{ id: 'base', parent: 'world', translation: { X: 0, Y: 0, Z: 0 } },
			],
			joints: [
				{
					id: 'alpha_joint',
					type: 'revolute',
					parent: 'base',
					axis: { X: 0, Y: 0, Z: 1 },
					min: -90,
					max: 90,
				},
				{
					id: 'zeta_joint',
					type: 'revolute',
					parent: 'base',
					axis: { X: 0, Y: 0, Z: 1 },
					min: -90,
					max: 90,
				},
			],
		} as never)

		expect(columnOf(shuffled, 'alpha_joint')).toBe(0)
		expect(columnOf(shuffled, 'zeta_joint')).toBe(1)
	})

	/**
	 * Pins current behavior, it does not endorse it. `grip` branches, so `soleLeafOf` declines and
	 * the fallback takes the last joint's only child. `alpha_finger` is just as legitimate a guess.
	 */
	it("remaps a child of the bare part name onto the last joint's child in the walk order", () => {
		const descriptors = byName(
			buildFrameDescriptors(
				frameSystemToPlanFrames([
					part({ name: 'grip', kinematics: branched }),
					part({ name: 'grip-child', parent: 'grip' }),
				])
			)
		)

		expect(descriptors.get('grip-child_origin')?.parent).toBe('grip:zeta_finger')
	})
})

// RDK gives the next trajectory column to each frame with degrees of freedom, walking the model
// breadth-first from `world` with children alphabetical. Not the `joints` array order.
describe('trajectory column order', () => {
	const chainModel = (joints: Array<{ id: string; parent: string }>) =>
		Struct.fromJson({
			links: [
				{ id: 'base', parent: 'world' },
				{ id: 'l1', parent: 'j1' },
				{ id: 'l2', parent: 'j2' },
				{ id: 'l3', parent: 'j3' },
			],
			joints: joints.map((joint) => ({ ...joint, type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } })),
		})

	const columnsOf = (kinematics: Struct) => {
		const descriptors = buildFrameDescriptors(
			frameSystemToPlanFrames([part({ name: 'arm', kinematics })])
		)
		return Object.fromEntries(
			descriptors
				.filter((descriptor) => descriptor.kind === 'joint')
				.map((descriptor) => [descriptor.name, descriptor.jointIndex])
		)
	}

	const chain = [
		{ id: 'j1', parent: 'base' },
		{ id: 'j2', parent: 'l1' },
		{ id: 'j3', parent: 'l2' },
	]

	it('numbers the joints down the chain', () => {
		expect(columnsOf(chainModel(chain))).toEqual({ 'arm:j1': 0, 'arm:j2': 1, 'arm:j3': 2 })
	})

	it('numbers by the chain, not by the order the joints were declared in', () => {
		expect(columnsOf(chainModel(chain.toReversed()))).toEqual(columnsOf(chainModel(chain)))
	})

	it("breaks a branch tie alphabetically, as RDK's breadth-first walk does", () => {
		const columns = columnsOf(
			Struct.fromJson({
				links: [{ id: 'base', parent: 'world' }],
				joints: [
					{ id: 'zeta', parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
					{ id: 'alpha', parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
				],
			})
		)

		expect(columns).toEqual({ 'arm:alpha': 0, 'arm:zeta': 1 })
	})

	/**
	 * Defensive, not observed: nothing on this route emits a numeric id, but a `Struct` can carry one
	 * and `0` is falsy. The fixture feeds a number through a parameter typed `string | undefined`.
	 */
	it('treats a numeric joint id as a name rather than as absent', () => {
		const columns = columnsOf(
			Struct.fromJson({
				links: [{ id: 'base', parent: 'world' }],
				joints: [
					{ id: 0, parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
					{ id: 1, parent: 0, type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
				],
			})
		)

		expect(columns).toEqual({ 'arm:0': 0, 'arm:1': 1 })
	})

	// An undeclared parent makes a second root, not a broken chain: RDK hangs it off `fs.World()`, so
	// `stray` sorts against `base` and takes column 0. Checked against `rdk v0.122.0`.
	it('roots a joint whose parent is not a declared node, the way RDK does', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		const columns = columnsOf(
			Struct.fromJson({
				links: [{ id: 'base', parent: 'world' }],
				joints: [
					{ id: 'j1', parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
					{ id: 'stray', parent: 'nowhere', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } },
				],
			})
		)

		expect(columns).toEqual({ 'arm:stray': 0, 'arm:j1': 1 })
		expect(warn).not.toHaveBeenCalled()
		warn.mockRestore()
	})
})

describe('node emission', () => {
	const model = Struct.fromJson({
		links: [
			{ id: 'base', parent: 'world' },
			{ id: 'tip', parent: 'j1' },
		],
		joints: [{ id: 'j1', parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } }],
	})

	it('writes every link before any joint', () => {
		const { parents } = frameSystemToPlanFrames([part({ name: 'arm', kinematics: model })])
		const emitted = Object.keys(parents).filter((key) => key.startsWith('arm:'))

		expect(emitted).toEqual(['arm:base', 'arm:tip', 'arm:j1'])
	})

	it("parents a node with no stated parent to the model's mount", () => {
		const { parents } = frameSystemToPlanFrames([
			part({ name: 'arm', kinematics: Struct.fromJson({ links: [{ id: 'base' }] }) }),
		])

		expect(parents['arm:base']).toBe('arm_origin')
	})
})

/**
 * A mesh is the one shape where the two generated `Geometry` classes actually differ, so it is the
 * only fixture a straight cast would fail on. Every other fixture here is a sphere.
 */
describe('geometry crossing between the two generated protos', () => {
	it('re-decodes a mesh rather than casting it', () => {
		const bytes = new Uint8Array([112, 108, 121, 10, 0, 255, 7])
		const geometry = new Geometry({
			geometryType: {
				case: 'mesh',
				value: new commonApi.Mesh({ contentType: 'ply', mesh: bytes }),
			},
			label: 'scan',
		})

		const { frames } = frameSystemToPlanFrames([part({ name: 'scan', geometry })])
		const { geometry: carried } = frames['scan_origin']!.frame as { geometry: LocalGeometry }

		expect(carried.geometryType.case).toBe('mesh')
		const mesh = carried.geometryType.case === 'mesh' ? carried.geometryType.value : undefined
		expect(mesh?.contentType).toBe('ply')
		expect([...(mesh?.mesh ?? [])]).toEqual([...bytes])
		expect(carried).toBeInstanceOf(LocalGeometry)
	})
})

describe('unsupported kinematics', () => {
	/**
	 * `dhParams` with no `links` or `joints` is what makes the guard's position testable: a fixture
	 * that also declared a link would pass with the check on either side of the emptiness test.
	 */
	it('warns and drops a DH model rather than drawing an armless chain', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		const { frames } = frameSystemToPlanFrames([
			part({
				name: 'dh-arm',
				kinematics: Struct.fromJson({
					kinematic_param_type: 'DH',
					dhParams: [{ id: 'a', parent: 'world' }],
				}),
			}),
		])

		expect(frames['dh-arm']?.frame_type).not.toBe('model')
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('DH kinematics'))
		warn.mockRestore()
	})

	it('warns and drops the whole model for a joint type RDK cannot build a frame for', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		const { frames, parents } = frameSystemToPlanFrames([
			part({
				name: 'arm',
				kinematics: Struct.fromJson({
					links: [
						{ id: 'base', parent: 'world' },
						{ id: 'tip', parent: 'spin' },
					],
					joints: [{ id: 'spin', parent: 'base', type: 'continuous', axis: { X: 0, Y: 0, Z: 1 } }],
				}),
			}),
		])

		expect(frames['arm:base']).toBeUndefined()
		expect(frames['arm:spin']).toBeUndefined()
		expect(frames['arm:tip']).toBeUndefined()
		expect(frames['arm']?.frame_type).toBe(DECODED_FRAME_TYPE)
		expect(frames['arm_origin']).toBeDefined()
		for (const parent of Object.values(parents)) {
			if (parent !== 'world') expect(frames[parent]).toBeDefined()
		}
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('unsupported type'))
		warn.mockRestore()
	})

	it.each([
		['a link', { links: [{ parent: 'world' }], joints: [] }],
		[
			'a joint',
			{
				links: [{ id: 'base', parent: 'world' }],
				joints: [{ parent: 'base', type: 'revolute', axis: { X: 0, Y: 0, Z: 1 } }],
			},
		],
	])('warns and drops the whole model for %s with no id', (_label, kinematics) => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		const { frames, parents } = frameSystemToPlanFrames([
			part({ name: 'arm', kinematics: Struct.fromJson(kinematics) }),
		])

		expect(frames['arm']?.frame_type).toBe(DECODED_FRAME_TYPE)
		expect(Object.keys(frames).some((key) => key.startsWith('arm:'))).toBe(false)
		for (const parent of Object.values(parents)) {
			if (parent !== 'world') expect(frames[parent]).toBeDefined()
		}
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('no id'))
		warn.mockRestore()
	})

	it.each([
		['an object with a length', { links: { length: 2 } }],
		['a string', { links: 'abc' }],
		['a number', { joints: 7 }],
	])('treats %s in place of a node list as no model', (_label, kinematics) => {
		const { frames } = frameSystemToPlanFrames([
			part({ name: 'a', kinematics: Struct.fromJson(kinematics) }),
		])

		expect(frames['a']?.frame_type).toBe(DECODED_FRAME_TYPE)
	})

	it('loses only the part whose kinematics cannot be read', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		// A `Value` submessage with no kind set, which is what an empty `Value` decodes to.
		const unreadable = Struct.fromBinary(
			new Uint8Array([10, 9, 10, 5, 108, 105, 110, 107, 115, 18, 0])
		)
		const { frames } = frameSystemToPlanFrames([
			part({ name: 'ok' }),
			part({ name: 'bad', kinematics: unreadable }),
			part({ name: 'also-ok' }),
		])

		expect(frames['ok']).toBeDefined()
		expect(frames['also-ok']).toBeDefined()
		expect(frames['bad']).toBeUndefined()
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('could not read the frame config'),
			expect.anything()
		)
		warn.mockRestore()
	})

	it('treats an empty kinematics struct as no model', () => {
		const { frames } = frameSystemToPlanFrames([
			part({ name: 'a', kinematics: Struct.fromJson({}) }),
		])
		expect(frames['a']?.frame_type).not.toBe('model')
	})
})
