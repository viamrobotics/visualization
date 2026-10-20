import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Geometry, Pose, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { KinematicsService } from '$lib/buf/kinematics/v1/kinematics_service_connect'
import {
	BuildRequest,
	BuildResponse,
	ExportKind,
	ExportRequest,
	ExportResponse,
	ImportRequest,
	ImportResponse,
	PoseRequest,
	PoseResponse,
} from '$lib/buf/kinematics/v1/kinematics_service_pb'
import {
	CollisionShape,
	InputReport,
	JointType,
	KinematicsSpec,
	LengthUnit,
	Link,
	Mimic,
	ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'

import { createKinematicsWorkbench, type KinematicsWorkbench } from '../kinematicsWorkbench.svelte'

const bytes = new Uint8Array([1, 2, 3])
const file = (name: string) => ({ name, bytes })

type BuildHandler = (request: BuildRequest) => BuildResponse | Promise<BuildResponse>
type ExportHandler = (request: ExportRequest) => ExportResponse | Promise<ExportResponse>

type PoseHandler = (request: PoseRequest) => PoseResponse | Promise<PoseResponse>

type ImportHandler = (request: ImportRequest) => ImportResponse | Promise<ImportResponse>

let importHandler: ReturnType<typeof vi.fn<ImportHandler>>
let build: ReturnType<typeof vi.fn<BuildHandler>>
let exportHandler: ReturnType<typeof vi.fn<ExportHandler>>
let workbench: KinematicsWorkbench
let pose: ReturnType<typeof vi.fn<PoseHandler>>

const mount = () => {
	workbench = createKinematicsWorkbench(() => 'http://unused', {
		debounceMs: 100,
		poseDebounceMs: 30,
		transport: createRouterTransport(({ service }) => {
			service(KinematicsService, {
				build: (request) => build(request),
				export: (request) => exportHandler(request),
				import: (request) => importHandler(request),
				pose: (request) => pose(request),
			})
		}),
	})
	return workbench
}

const frame = (referenceFrame: string, withGeometry = false) =>
	new Transform({
		referenceFrame,
		uuid: new TextEncoder().encode(referenceFrame.padEnd(16, '_').slice(0, 16)),
		poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world', pose: new Pose({ oZ: 1 }) }),
		physicalObject: withGeometry ? new Geometry() : undefined,
	})

const response = (dof: number, frameCount = 1) =>
	new BuildResponse({
		report: new ValidationReport({ dof }),
		frames: Array.from({ length: frameCount }, (_, index) => frame(`frame-${index}`)),
	})

describe('createKinematicsWorkbench', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		build = vi.fn<BuildHandler>(() => response(1))
		exportHandler = vi.fn<ExportHandler>(() => new ExportResponse())
		importHandler = vi.fn<ImportHandler>(() => new ImportResponse())
		pose = vi.fn<PoseHandler>(() => new PoseResponse())
	})

	afterEach(() => {
		workbench.destroy()
		vi.useRealTimers()
	})

	it.each([
		['part.dae', LengthUnit.METERS],
		['PART.DAE', LengthUnit.METERS],
		['part.obj', LengthUnit.MILLIMETERS],
	])('defaults the mesh unit of %s', (name, unit) => {
		mount()
		workbench.addSources([file(name)])

		expect(workbench.spec.links[0]?.meshUnit).toBe(unit)
	})

	it('starts empty and creates links with defaults', () => {
		mount()
		expect(workbench.status).toBe('empty')
		workbench.addSources([file('Gripper.stl')])
		const [link] = workbench.spec.links
		expect(link?.id).toBe('gripper')
		expect(link?.meshUnit).toBe(LengthUnit.MILLIMETERS)
		expect(link?.collision).toBe(CollisionShape.MESH)
		expect(link?.maxTriangles).toBe(1000)
		expect(link?.origin?.oZ).toBe(1)
		expect(workbench.spec.name).toBe('gripper')
		expect(workbench.status).toBe('building')
	})

	it('coalesces three quick edits into one build', async () => {
		mount()
		workbench.addSources([file('a.stl')])
		workbench.setName('one')
		await vi.advanceTimersByTimeAsync(50)
		workbench.setName('two')
		await vi.advanceTimersByTimeAsync(50)
		expect(build).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(100)
		expect(build).toHaveBeenCalledTimes(1)
		expect(build.mock.calls[0]![0].spec?.name).toBe('two')
		expect(workbench.status).toBe('ready')
		expect(workbench.report?.dof).toBe(1)
		expect(workbench.snapshot?.transforms).toHaveLength(1)
	})

	it('ignores a slow build superseded by a later one', async () => {
		let release: (value: BuildResponse) => void = () => {}
		build
			.mockImplementationOnce(() => new Promise<BuildResponse>((resolve) => (release = resolve)))
			.mockImplementationOnce(() => response(2))
		mount()
		workbench.addSources([file('a.stl')])
		await vi.advanceTimersByTimeAsync(100)
		workbench.setName('again')
		await vi.advanceTimersByTimeAsync(100)
		expect(workbench.report?.dof).toBe(2)
		release(response(99))
		await vi.advanceTimersByTimeAsync(0)
		expect(workbench.report?.dof).toBe(2)
		expect(workbench.status).toBe('ready')
	})

	it('keeps the last report when a build errors', async () => {
		mount()
		workbench.addSources([file('a.stl')])
		await vi.advanceTimersByTimeAsync(100)
		const snapshot = workbench.snapshot
		build.mockImplementationOnce(() => {
			throw new ConnectError('bad mesh', Code.InvalidArgument)
		})
		workbench.setName('x')
		await vi.advanceTimersByTimeAsync(100)
		expect(workbench.status).toBe('error')
		expect(workbench.error).toBe('bad mesh')
		expect(workbench.report?.dof).toBe(1)
		expect(workbench.snapshot).toBe(snapshot)
	})

	it('holds the build frames, with visual meshes only when requested, and keeps its uuid', async () => {
		build.mockImplementation((request) => {
			const result = response(1, 2)
			if (request.includeVisualMeshes) result.frames.push(frame('a visual'), frame('b visual'))
			return result
		})
		mount()
		workbench.addSources([file('a.stl')])
		await vi.advanceTimersByTimeAsync(100)
		const uuid = workbench.snapshot?.uuid
		expect(workbench.snapshot?.transforms).toHaveLength(2)
		workbench.showVisualMeshes = true
		expect(workbench.status).toBe('building')
		await vi.advanceTimersByTimeAsync(100)
		expect(workbench.snapshot?.transforms.map((entry) => entry.referenceFrame)).toEqual([
			'frame-0',
			'frame-1',
			'a visual',
			'b visual',
		])
		expect(workbench.snapshot?.uuid).toEqual(uuid)
	})

	it('strips link geometry when collision is hidden, without building', async () => {
		build.mockImplementation(
			() =>
				new BuildResponse({
					report: new ValidationReport({ dof: 0 }),
					frames: [frame('a', true), frame('a visual', true), frame('joint', true)],
				})
		)
		mount()
		workbench.addSources([file('a.stl')])
		await vi.advanceTimersByTimeAsync(100)
		expect(build).toHaveBeenCalledTimes(1)
		const uuid = workbench.snapshot?.uuid
		const geometry = () =>
			Object.fromEntries(
				(workbench.snapshot?.transforms ?? []).map((entry) => [
					entry.referenceFrame,
					entry.physicalObject !== undefined,
				])
			)
		expect(workbench.showCollision).toBe(true)
		expect(geometry()).toEqual({ a: true, 'a visual': true, joint: true })

		workbench.showCollision = false
		expect(geometry()).toEqual({ a: false, 'a visual': true, joint: true })
		expect(workbench.snapshot?.uuid).toEqual(uuid)

		workbench.showCollision = true
		expect(geometry()).toEqual({ a: true, 'a visual': true, joint: true })

		await vi.advanceTimersByTimeAsync(500)
		expect(build).toHaveBeenCalledTimes(1)
		expect(workbench.status).toBe('ready')
	})

	it('keeps the hidden-collision snapshot through a pose-only edit until the rebuild lands', async () => {
		build.mockImplementation(
			() =>
				new BuildResponse({
					report: new ValidationReport({ dof: 0 }),
					frames: [frame('a', true)],
				})
		)
		mount()
		workbench.addSources([file('a.stl')])
		await vi.advanceTimersByTimeAsync(100)
		workbench.showCollision = false
		const before = workbench.snapshot

		workbench.updateLink('a', { origin: new Pose({ x: 5, oZ: 1 }) })

		expect(workbench.snapshot).toBe(before)
	})

	it('keeps calibration when a file is re-added', () => {
		mount()
		workbench.addSources([file('a.stl')])
		workbench.updateLink('a', { meshUnit: LengthUnit.INCHES })
		workbench.addSources([{ name: 'a.stl', bytes: new Uint8Array([9]) }])
		expect(workbench.spec.links).toHaveLength(1)
		expect(workbench.spec.links[0]?.meshUnit).toBe(LengthUnit.INCHES)
	})

	it('sanitizes and dedupes link ids', () => {
		mount()
		workbench.addSources([
			file('Vacuum Frame.STL'),
			file('vacuum frame.ply'),
			file('tcp.stl'),
			file('123.stl'),
			file('__.stl'),
		])
		expect(workbench.spec.links.map((link) => link.id)).toEqual([
			'vacuum-frame',
			'vacuum-frame-2',
			'tcp-link',
			'123',
			'link',
		])
	})

	it('removes a link and its bytes', async () => {
		mount()
		workbench.addSources([file('a.stl'), file('b.stl')])
		workbench.removeLink('a')
		expect(workbench.spec.links.map((link) => link.id)).toEqual(['b'])
		await vi.advanceTimersByTimeAsync(100)
		expect(Object.keys(build.mock.calls[0]![0].sources)).toEqual(['b.stl'])
		workbench.removeLink('b')
		expect(workbench.status).toBe('empty')
	})

	it('rejects exportZip with the server message and the cause', async () => {
		exportHandler.mockImplementation(() => {
			throw new ConnectError('model is invalid', Code.FailedPrecondition)
		})
		mount()
		workbench.addSources([file('a.stl')])
		const failure = await workbench.exportZip(ExportKind.PACKAGE).catch((error: unknown) => error)
		expect(failure).toBeInstanceOf(Error)
		expect((failure as Error).message).toBe('model is invalid')
		expect((failure as Error).cause).toBeInstanceOf(ConnectError)
	})

	it('returns the zip from exportZip', async () => {
		exportHandler.mockImplementation(
			() => new ExportResponse({ zip: new Uint8Array([7]), fileName: 'x.zip' })
		)
		mount()
		const result = await workbench.exportZip(ExportKind.PACKAGE)
		expect(result.fileName).toBe('x.zip')
		expect([...result.bytes]).toEqual([7])
	})

	it('cancels a pending build on destroy', async () => {
		mount()
		workbench.addSources([file('a.stl')])
		workbench.destroy()
		await vi.advanceTimersByTimeAsync(500)
		expect(build).not.toHaveBeenCalled()
	})

	describe('reopening a project', () => {
		const specWith = (...paths: string[]) =>
			new KinematicsSpec({
				name: 'tool',
				links: paths.map(
					(path, index) =>
						new Link({
							id: `link-${index}`,
							meshPath: path,
							meshUnit: LengthUnit.MILLIMETERS,
						})
				),
			})

		const readyWorkbench = async () => {
			mount()
			workbench.loadProject(specWith('b.stl', 'a.stl'), [file('a.stl'), file('b.stl')])
			await vi.advanceTimersByTimeAsync(100)
		}

		it('lists missing sources sorted and builds nothing until they arrive', async () => {
			mount()
			workbench.loadProject(specWith('z.stl', 'a.stl', 'a.stl'), [file('other.stl')])
			await vi.advanceTimersByTimeAsync(500)

			expect(workbench.missingSources).toEqual(['a.stl', 'z.stl'])
			expect(workbench.status).toBe('incomplete')
			expect(build).not.toHaveBeenCalled()
		})

		it('builds once the last missing source is supplied', async () => {
			mount()
			workbench.loadProject(specWith('a.stl', 'b.stl'), [file('a.stl')])
			workbench.setSourceBytes('b.stl', bytes)
			await vi.advanceTimersByTimeAsync(100)

			expect(workbench.missingSources).toEqual([])
			expect(workbench.status).toBe('ready')
			expect(Object.keys(build.mock.calls[0]![0].sources).toSorted()).toEqual(['a.stl', 'b.stl'])
		})

		it('keeps the last report and snapshot while a link goes missing', async () => {
			await readyWorkbench()
			const snapshot = workbench.snapshot
			workbench.updateLink('link-0', { meshPath: 'gone.stl' })

			expect(workbench.status).toBe('incomplete')
			expect(workbench.missingSources).toEqual(['gone.stl'])
			expect(workbench.report?.dof).toBe(1)
			expect(workbench.snapshot).toBe(snapshot)
		})

		it('clears previous when a project is loaded', async () => {
			await readyWorkbench()
			workbench.setSourceBytes('a.stl', new Uint8Array([9]))
			await vi.advanceTimersByTimeAsync(100)
			workbench.loadProject(specWith('a.stl'), [file('a.stl')])

			expect(workbench.previous).toBeUndefined()
		})

		it('keeps the previous report and calibration when bytes are replaced', async () => {
			await readyWorkbench()
			workbench.updateLink('link-1', { meshUnit: LengthUnit.INCHES })
			await vi.advanceTimersByTimeAsync(100)
			build.mockImplementation(() => response(2))
			workbench.setSourceBytes('a.stl', new Uint8Array([9]))

			expect(workbench.previous?.report.dof).toBe(1)
			expect(workbench.spec.links[1]?.meshUnit).toBe(LengthUnit.INCHES)

			await vi.advanceTimersByTimeAsync(100)

			expect(workbench.report?.dof).toBe(2)
			expect(workbench.previous?.report.dof).toBe(1)
			expect([...build.mock.calls.at(-1)![0].sources['a.stl']!]).toEqual([9])
		})

		it('sets no previous when a missing source is supplied', async () => {
			mount()
			workbench.loadProject(specWith('a.stl', 'b.stl'), [file('a.stl')])
			await vi.advanceTimersByTimeAsync(100)
			workbench.setSourceBytes('b.stl', bytes)

			expect(workbench.previous).toBeUndefined()
		})

		it('adds a ghost per part, parented to that part, when showPrevious is on', async () => {
			build.mockImplementation(
				() =>
					new BuildResponse({
						report: new ValidationReport({ dof: 1 }),
						frames: [frame('link-0', true), frame('link-1', true), frame('joint-a')],
					})
			)
			await readyWorkbench()
			workbench.setSourceBytes('a.stl', new Uint8Array([9]))
			await vi.advanceTimersByTimeAsync(100)
			const before = workbench.snapshot?.transforms ?? []

			workbench.showPrevious = true
			const after = workbench.snapshot?.transforms ?? []
			const ghosts = after.slice(before.length)

			expect(before).toHaveLength(3)
			expect(ghosts.map((ghost) => ghost.referenceFrame)).toEqual([
				'link-0 previous',
				'link-1 previous',
			])
			expect(ghosts.map((ghost) => ghost.poseInObserverFrame?.referenceFrame)).toEqual([
				'link-0',
				'link-1',
			])
			expect(ghosts.every((ghost) => ghost.poseInObserverFrame?.pose?.x === 0)).toBe(true)
			expect(ghosts.every((ghost) => ghost.physicalObject !== undefined)).toBe(true)
			expect(ghosts.every((ghost) => ghost.metadata !== undefined)).toBe(true)
			expect(ghosts.every((ghost) => ghost.uuid.length === 16)).toBe(true)
			expect(new Set(ghosts.map((ghost) => ghost.uuid.join(','))).size).toBe(2)
			expect(build).toHaveBeenCalledTimes(2)
		})

		it('drops the ghosts again when showPrevious is turned off', async () => {
			await readyWorkbench()
			workbench.setSourceBytes('a.stl', new Uint8Array([9]))
			await vi.advanceTimersByTimeAsync(100)
			workbench.showPrevious = true
			workbench.showPrevious = false

			expect(workbench.snapshot?.transforms).toHaveLength(1)
		})

		it('loads the spec and sources from an imported zip', async () => {
			importHandler.mockImplementation(
				() =>
					new ImportResponse({
						spec: specWith('a.stl'),
						sources: { 'a.stl': new Uint8Array([5]) },
					})
			)
			mount()
			await workbench.importZip(new Uint8Array([1]))
			await vi.advanceTimersByTimeAsync(100)

			expect(workbench.spec.name).toBe('tool')
			expect(workbench.missingSources).toEqual([])
			expect([...build.mock.calls[0]![0].sources['a.stl']!]).toEqual([5])
		})

		it('rejects importZip with the server message and the cause', async () => {
			importHandler.mockImplementation(() => {
				throw new ConnectError('not a kinematics zip', Code.InvalidArgument)
			})
			mount()
			const failure = await workbench.importZip(bytes).catch((error: unknown) => error)

			expect((failure as Error).message).toBe('not a kinematics zip')
			expect((failure as Error).cause).toBeInstanceOf(ConnectError)
		})
	})

	describe('joints', () => {
		const addLink = () => workbench.addSources([file('a.stl')])

		it('adds a prismatic joint on the model base with defaults', () => {
			mount()
			addLink()
			const id = workbench.addJoint({ id: 'slide' })
			const joint = workbench.spec.joints[0]
			expect(id).toBe('slide')
			expect(joint?.type).toBe(JointType.PRISMATIC)
			expect(joint?.origin?.oZ).toBe(1)
			expect(joint?.axis?.z).toBe(1)
			expect([joint?.lower, joint?.upper, joint?.parent]).toEqual([0, 100, ''])
		})

		it('keeps joint fields the caller supplied', () => {
			mount()
			workbench.addJoint({ id: 'hinge', type: JointType.REVOLUTE, upper: 90 })
			const joint = workbench.spec.joints[0]
			expect([joint?.type, joint?.upper]).toEqual([JointType.REVOLUTE, 90])
		})

		it('suffixes an id that a link or joint already uses', () => {
			mount()
			workbench.addSources([file('slide.stl')])
			const ids = [
				workbench.addJoint({ id: 'slide' }),
				workbench.addJoint({ id: 'slide' }),
				workbench.addJoint({}),
			]
			expect(ids).toEqual(['slide-2', 'slide-3', 'joint'])
		})

		it.each([
			{ requested: 'tcp', expected: 'tcp-joint' },
			{ requested: 'base_origin', expected: 'base_origin-joint' },
		])('never uses the reserved id $requested', ({ requested, expected }) => {
			mount()
			expect(workbench.addJoint({ id: requested })).toBe(expected)
		})

		it('schedules a build', () => {
			mount()
			addLink()
			workbench.addJoint({ id: 'slide' })
			expect(workbench.status).toBe('building')
		})

		it('rewrites every reference when a joint is renamed', () => {
			mount()
			addLink()
			workbench.addJoint({ id: 'j1' })
			workbench.addJoint({ id: 'j2', parent: 'j1' })
			workbench.addJoint({ id: 'j3', mimic: new Mimic({ joint: 'j1', multiplier: 2 }) })
			workbench.updateLink('a', { parent: 'j1' })
			workbench.setTcpParent('j1')

			workbench.updateJoint('j1', { id: 'z', upper: 5 })

			const spec = workbench.spec
			expect(spec.joints.map((joint) => joint.id)).toEqual(['z', 'j2', 'j3'])
			expect(spec.joints[0]?.upper).toBe(5)
			expect(spec.joints[1]?.parent).toBe('z')
			expect(spec.joints[2]?.mimic?.joint).toBe('z')
			expect(spec.links[0]?.parent).toBe('z')
			expect(spec.tcpParent).toBe('z')
		})

		it('moves children to the removed joints parent and drops mimics of it', () => {
			mount()
			addLink()
			workbench.addJoint({ id: 'j1' })
			workbench.addJoint({ id: 'j2', parent: 'j1' })
			workbench.addJoint({ id: 'j3', parent: 'j2' })
			workbench.addJoint({ id: 'j4', mimic: new Mimic({ joint: 'j2' }) })
			workbench.updateLink('a', { parent: 'j2' })
			workbench.setTcpParent('j2')

			workbench.removeJoint('j2')

			const spec = workbench.spec
			expect(spec.joints.map((joint) => joint.id)).toEqual(['j1', 'j3', 'j4'])
			expect(spec.joints[1]?.parent).toBe('j1')
			expect(spec.joints[2]?.mimic).toBeUndefined()
			expect(spec.links[0]?.parent).toBe('j1')
			expect(spec.tcpParent).toBe('j1')
		})

		it('moves a child links origin when the joint origin changes', () => {
			mount()
			addLink()
			workbench.addJoint({ id: 'j1' })
			workbench.updateLink('a', { parent: 'j1', origin: new Pose({ x: 10, oZ: 1 }) })

			workbench.updateJoint('j1', { origin: new Pose({ x: 5, oZ: 1 }) })

			expect(workbench.spec.links[0]?.origin?.x).toBeCloseTo(15)
		})

		it('leaves every link origin untouched when only upper changes', () => {
			mount()
			addLink()
			workbench.addJoint({ id: 'j1' })
			workbench.updateLink('a', { parent: 'j1', origin: new Pose({ x: 10, oZ: 1 }) })

			workbench.updateJoint('j1', { upper: 50 })

			expect(workbench.spec.links[0]?.origin?.x).toBe(10)
		})

		it('sets the TCP parent and schedules a build', () => {
			mount()
			addLink()
			workbench.setTcpParent('slide')
			expect(workbench.spec.tcpParent).toBe('slide')
			expect(workbench.status).toBe('building')
		})
	})

	describe('inputs', () => {
		const withLimits = (...limits: [number, number][]) =>
			new BuildResponse({
				report: new ValidationReport({
					dof: limits.length,
					inputs: limits.map(([min, max]) => new InputReport({ min, max })),
				}),
				frames: [frame('link', true), frame('joint')],
			})

		const mountBuilt = async (...limits: [number, number][]) => {
			build.mockImplementation(() => withLimits(...limits))
			mount()
			workbench.addSources([file('a.stl')])
			workbench.setName('model')
			await vi.advanceTimersByTimeAsync(100)
		}

		const movedJoint = (x: number) => {
			const moved = frame('joint')
			moved.poseInObserverFrame = new PoseInFrame({
				referenceFrame: 'world',
				pose: new Pose({ x, oZ: 1 }),
			})
			return moved
		}

		it('resets inputs to zero when the report has one input', async () => {
			await mountBuilt([0, 50])
			expect(workbench.inputs).toEqual([0])
		})

		it('resets inputs to the nearest limit when zero is out of range', async () => {
			await mountBuilt([10, 50])
			expect(workbench.inputs).toEqual([10])
		})

		it('sends the current inputs with the next build', async () => {
			await mountBuilt([0, 50], [0, 20])
			workbench.setInput(1, 8)
			workbench.setName('again')
			await vi.advanceTimersByTimeAsync(100)
			expect(build.mock.lastCall![0].inputs).toEqual([0, 8])
		})

		it('clamps a value into the limit', async () => {
			await mountBuilt([0, 50])
			workbench.setInput(0, 80)
			expect(workbench.inputs).toEqual([50])
			workbench.setInput(0, -5)
			expect(workbench.inputs).toEqual([0])
		})

		it('ignores an out-of-range index', async () => {
			await mountBuilt([0, 50])
			workbench.setInput(3, 10)
			await vi.advanceTimersByTimeAsync(100)
			expect(workbench.inputs).toEqual([0])
			expect(pose).not.toHaveBeenCalled()
		})

		it('coalesces three quick moves into one pose call carrying the spec and inputs', async () => {
			await mountBuilt([0, 50])
			pose.mockImplementation(() => new PoseResponse({ frames: [movedJoint(30)] }))
			workbench.setInput(0, 10)
			await vi.advanceTimersByTimeAsync(10)
			workbench.setInput(0, 20)
			await vi.advanceTimersByTimeAsync(10)
			workbench.setInput(0, 30)
			await vi.advanceTimersByTimeAsync(30)
			expect(pose).toHaveBeenCalledTimes(1)
			const request = pose.mock.calls[0]![0]
			expect(request.inputs).toEqual([30])
			expect(request.spec?.name).toBe('model')
		})

		it('merges a posed joint by uuid and leaves parts untouched', async () => {
			await mountBuilt([0, 50])
			const part = workbench.snapshot?.transforms[0]
			pose.mockImplementation(() => new PoseResponse({ frames: [movedJoint(30)] }))
			workbench.setInput(0, 30)
			await vi.advanceTimersByTimeAsync(30)
			const transforms = workbench.snapshot?.transforms ?? []
			expect(transforms).toHaveLength(2)
			expect(transforms[0]).toBe(part)
			expect(transforms[1]?.referenceFrame).toBe('joint')
			expect(transforms[1]?.poseInObserverFrame?.pose?.x).toBe(30)
		})

		it('leaves visual meshes in place when a pose merges', async () => {
			build.mockImplementation(
				() =>
					new BuildResponse({
						report: new ValidationReport({ inputs: [new InputReport({ min: 0, max: 5 })] }),
						frames: [frame('joint'), frame('link visual', true)],
					})
			)
			mount()
			workbench.addSources([file('a.stl')])
			workbench.showVisualMeshes = true
			await vi.advanceTimersByTimeAsync(100)
			pose.mockImplementation(() => new PoseResponse({ frames: [movedJoint(1)] }))
			workbench.setInput(0, 1)
			await vi.advanceTimersByTimeAsync(30)
			const transforms = workbench.snapshot?.transforms ?? []
			expect(transforms.map((entry) => entry.referenceFrame)).toEqual(['joint', 'link visual'])
			expect(transforms[0]?.poseInObserverFrame?.pose?.x).toBe(1)
		})

		it('ignores a pose that resolves after a newer setInput', async () => {
			await mountBuilt([0, 50])
			let release: (value: PoseResponse) => void = () => {}
			pose
				.mockImplementationOnce(() => new Promise<PoseResponse>((resolve) => (release = resolve)))
				.mockImplementationOnce(() => new PoseResponse({ frames: [movedJoint(2)] }))
			workbench.setInput(0, 10)
			await vi.advanceTimersByTimeAsync(30)
			workbench.setInput(0, 20)
			await vi.advanceTimersByTimeAsync(30)
			release(new PoseResponse({ frames: [movedJoint(9)] }))
			await vi.advanceTimersByTimeAsync(0)
			expect(workbench.snapshot?.transforms[1]?.poseInObserverFrame?.pose?.x).toBe(2)
		})

		it('sets the error when a pose fails', async () => {
			await mountBuilt([0, 50])
			pose.mockImplementation(() => {
				throw new ConnectError('pose failed', Code.InvalidArgument)
			})
			workbench.setInput(0, 10)
			await vi.advanceTimersByTimeAsync(30)
			expect(workbench.status).toBe('error')
			expect(workbench.error).toBe('pose failed')
		})
	})
})
