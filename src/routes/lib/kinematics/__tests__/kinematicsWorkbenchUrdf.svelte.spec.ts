import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Pose } from '$lib/buf/common/v1/common_pb'
import { KinematicsService } from '$lib/buf/kinematics/v1/kinematics_service_connect'
import {
	BuildRequest,
	BuildResponse,
	ImportRequest,
	ImportResponse,
	ImportURDFRequest,
	ImportURDFResponse,
} from '$lib/buf/kinematics/v1/kinematics_service_pb'
import {
	ImportReport,
	KinematicsSpec,
	Link,
	LinkReport,
	Primitive,
	ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'

import { createKinematicsWorkbench, type KinematicsWorkbench } from '../kinematicsWorkbench.svelte'

const file = (name: string) => ({ name, bytes: new Uint8Array([1, 2, 3]) })

let importHandler: ReturnType<typeof vi.fn<(request: ImportRequest) => ImportResponse>>
let urdfHandler: ReturnType<typeof vi.fn<(request: ImportURDFRequest) => ImportURDFResponse>>
let build: ReturnType<typeof vi.fn<(request: BuildRequest) => BuildResponse>>
let workbench: KinematicsWorkbench

const mount = () => {
	workbench = createKinematicsWorkbench(() => 'http://unused', {
		debounceMs: 100,
		transport: createRouterTransport(({ service }) => {
			service(KinematicsService, {
				build: (request) => build(request),
				import: (request) => importHandler(request),
				importURDF: (request) => urdfHandler(request),
			})
		}),
	})
	return workbench
}

const urdfSpec = () =>
	new KinematicsSpec({
		name: 'arm',
		links: [
			new Link({ id: 'base', meshPath: 'base.stl' }),
			new Link({ id: 'ball', primitive: new Primitive() }),
		],
	})

const urdfResponse = (tcpLink = 'tool') =>
	new ImportURDFResponse({
		spec: urdfSpec(),
		sources: { 'base.stl': new Uint8Array([7]) },
		report: new ImportReport({ tcpLink, tcpCandidates: ['tool', 'flange'], urdfPath: 'a.urdf' }),
	})

describe('workbench URDF import and simplify', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		importHandler = vi.fn(() => new ImportResponse())
		urdfHandler = vi.fn(() => urdfResponse())
		build = vi.fn(() => new BuildResponse({ report: new ValidationReport() }))
	})

	afterEach(() => {
		workbench.destroy()
		vi.useRealTimers()
	})

	describe('placeholder snapshot', () => {
		it('shows root at identity and tcp under it at the tcp pose before any build', () => {
			mount()
			workbench.setTcpPose({ x: 5, oZ: 1 } as Pose)
			const frames = workbench.snapshot.transforms

			expect(frames.map((frame) => frame.referenceFrame)).toEqual(['root', 'tcp'])
			expect(frames[0]!.poseInObserverFrame?.pose?.oZ).toBe(1)
			expect(frames[1]!.poseInObserverFrame?.referenceFrame).toBe('root')
			expect(frames[1]!.poseInObserverFrame?.pose?.x).toBe(5)
			const hex = (bytes: Uint8Array) =>
				[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
			expect(hex(frames[0]!.uuid)).toBe('6305ff317a665dd5b65675cb312f08d6')
			expect(hex(frames[1]!.uuid)).toBe('f30a312b6ec255ac95393ae21322fe94')
		})

		it('gives way to the build and returns when the links are gone', async () => {
			mount()
			workbench.addSources([file('a.stl')])
			await vi.advanceTimersByTimeAsync(100)
			expect(workbench.snapshot.transforms).toHaveLength(0)

			workbench.removeLink('a')
			expect(workbench.snapshot.transforms.map((frame) => frame.referenceFrame)).toEqual([
				'root',
				'tcp',
			])
		})
	})

	describe('model name', () => {
		it('defaults to the first link id', () => {
			mount()
			workbench.addSources([file('Gripper.stl'), file('b.stl')])
			expect(workbench.spec.name).toBe('gripper')
		})

		it('uses the dropped folder name', () => {
			mount()
			workbench.addSources([file('drywall/cad/a.stl'), file('drywall/b.stl')])
			expect(workbench.spec.name).toBe('drywall')
		})

		it('keeps a name that is already set', () => {
			mount()
			workbench.setName('mine')
			workbench.addSources([file('a.stl')])
			expect(workbench.spec.name).toBe('mine')
		})

		it('keeps a reopened project name', () => {
			mount()
			workbench.loadProject(new KinematicsSpec({ name: 'saved' }), [])
			workbench.addSources([file('a.stl')])
			expect(workbench.spec.name).toBe('saved')
		})
	})

	describe('reserved ids', () => {
		it('renames a root.stl link and a root joint', () => {
			mount()
			workbench.addSources([file('root.stl')])
			expect(workbench.spec.links[0]!.id).toBe('root-link')
			expect(workbench.addJoint({ id: 'root' })).toBe('root-joint')
		})
	})

	describe('importUrdf', () => {
		it('sends files, loads the result, and keeps the report', async () => {
			mount()
			await workbench.importUrdf({ files: [file('robot.urdf'), file('base.stl')] })
			await vi.advanceTimersByTimeAsync(100)

			const request = urdfHandler.mock.calls[0]![0]
			expect(Object.keys(request.files).toSorted()).toEqual(['base.stl', 'robot.urdf'])
			expect(request.tcpLink).toBe('')
			expect(workbench.spec.name).toBe('arm')
			expect(workbench.importReport?.tcpCandidates).toEqual(['tool', 'flange'])
			expect(workbench.missingSources).toEqual([])
			expect(build).toHaveBeenCalledTimes(1)
		})

		it('sends a zip', async () => {
			mount()
			await workbench.importUrdf({ zip: new Uint8Array([9]) })
			expect([...urdfHandler.mock.calls[0]![0].zip]).toEqual([9])
		})

		it('skips primitive links in missing sources and in the build sources', async () => {
			mount()
			await workbench.importUrdf({ zip: new Uint8Array([9]) })
			await vi.advanceTimersByTimeAsync(100)
			expect(workbench.missingSources).toEqual([])
			expect(workbench.status).toBe('ready')
			expect(Object.keys(build.mock.calls[0]![0].sources)).toEqual(['base.stl'])
		})

		it('rejects with the server message and the cause', async () => {
			urdfHandler.mockImplementation(() => {
				throw new ConnectError('no urdf found', Code.InvalidArgument)
			})
			mount()
			const failure = await workbench
				.importUrdf({ zip: new Uint8Array([9]) })
				.catch((error: unknown) => error)
			expect((failure as Error).message).toBe('no urdf found')
			expect((failure as Error).cause).toBeInstanceOf(ConnectError)
			expect(workbench.importReport).toBeUndefined()
		})

		it('clears the report on any other load', async () => {
			mount()
			await workbench.importUrdf({ zip: new Uint8Array([9]) })
			workbench.loadProject(new KinematicsSpec(), [])
			expect(workbench.importReport).toBeUndefined()
			await workbench.chooseImportTcp('flange')
			expect(urdfHandler).toHaveBeenCalledTimes(1)
		})
	})

	describe('chooseImportTcp', () => {
		it('re-runs the stored upload with the chosen link', async () => {
			mount()
			await workbench.importUrdf({ zip: new Uint8Array([9]) })
			urdfHandler.mockImplementation(() => urdfResponse('flange'))
			await workbench.chooseImportTcp('flange')

			expect(urdfHandler).toHaveBeenCalledTimes(2)
			expect(urdfHandler.mock.calls[1]![0].tcpLink).toBe('flange')
			expect([...urdfHandler.mock.calls[1]![0].zip]).toEqual([9])
			expect(workbench.importReport?.tcpLink).toBe('flange')
		})

		it('does nothing without an upload', async () => {
			mount()
			await workbench.chooseImportTcp('flange')
			expect(urdfHandler).not.toHaveBeenCalled()
		})
	})

	describe('importZip fallback', () => {
		it('falls back to the URDF import on NotFound with the same bytes', async () => {
			importHandler.mockImplementation(() => {
				throw new ConnectError('whatever wording', Code.NotFound)
			})
			mount()
			await workbench.importZip(new Uint8Array([4, 5]))

			expect([...urdfHandler.mock.calls[0]![0].zip]).toEqual([4, 5])
			expect(workbench.importReport).toBeDefined()
		})

		it('does not fall back on another code, even with not-found wording', async () => {
			importHandler.mockImplementation(() => {
				throw new ConnectError('kinematics.json not found', Code.InvalidArgument)
			})
			mount()
			await expect(workbench.importZip(new Uint8Array([4]))).rejects.toThrow('kinematics.json')
			expect(urdfHandler).not.toHaveBeenCalled()
		})
	})

	describe('simplify', () => {
		const built = async () => {
			build.mockImplementation(
				() =>
					new BuildResponse({
						report: new ValidationReport({
							links: [
								new LinkReport({ id: 'a', overTriangleLimit: true, suggestedMaxTriangles: 400 }),
								new LinkReport({ id: 'b', overTriangleLimit: true, suggestedMaxTriangles: 250 }),
								new LinkReport({ id: 'c', overTriangleLimit: false, suggestedMaxTriangles: 90 }),
							],
						}),
					})
			)
			mount()
			workbench.addSources([file('a.stl'), file('b.stl'), file('c.stl')])
			await vi.advanceTimersByTimeAsync(100)
		}
		const max = () => workbench.spec.links.map((link) => link.maxTriangles)

		it('simplifies one link to its suggestion', async () => {
			await built()
			workbench.simplify('b')
			expect(max()).toEqual([1000, 250, 1000])
		})

		it('simplifyAll touches only over-limit links', async () => {
			await built()
			workbench.simplifyAll()
			expect(max()).toEqual([400, 250, 1000])
		})

		it('ignores a link without a report', async () => {
			await built()
			workbench.simplify('missing')
			expect(max()).toEqual([1000, 1000, 1000])
		})
	})
})
