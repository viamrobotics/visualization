import type { World } from 'koota'

import { Struct } from '@bufbuild/protobuf'
import { render } from '@testing-library/svelte'
import { Geometry, PoseInFrame, RectangularPrism, robotApi, Transform } from '@viamrobotics/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TrajectoryStep } from '#lib/motion/jointPose.js'

import { PreviewGhost } from '#lib/components/motion/previewGhostTrait.js'
import { traits } from '#lib/ecs/index.js'
import { parsePlanResult } from '#lib/motion/planDoCommand.js'

import type { TrajectoryPreviewProbeHandle } from './__fixtures__/TrajectoryPreviewProbe.svelte'

import { frameSystemGoldenCases } from '../../../motion/__tests__/__fixtures__/frameSystemGolden'
import planFreeSpace from '../../../motion/__tests__/__fixtures__/plan-free-space.json'
import { setFrameSystem } from './__fixtures__/TrajectoryPreviewFrameSystem.svelte'
import TrajectoryPreviewHost from './__fixtures__/TrajectoryPreviewHost.svelte'

vi.mock('@threlte/core/webgpu', (importOriginal) => importOriginal())
vi.mock('@threlte/extras/webgpu', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useConfigFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useResourceByName.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFragmentInfo.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/usePartConfig.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useLinked.svelte.js', (importOriginal) => importOriginal())

vi.mock('@viamrobotics/svelte-sdk', async (importOriginal) => {
	const sdk = await importOriginal<typeof import('@viamrobotics/svelte-sdk')>()
	const { frameSystemQuery } = await import('./__fixtures__/TrajectoryPreviewFrameSystem.svelte')
	const createRobotQuery = (...args: unknown[]) =>
		args[1] === 'frameSystemConfig'
			? frameSystemQuery
			: (sdk.createRobotQuery as (...queryArgs: unknown[]) => unknown)(...args)
	return { ...sdk, createRobotQuery: createRobotQuery as typeof sdk.createRobotQuery }
})

vi.mock('idb-keyval', () => ({
	get: vi.fn(() => Promise.resolve(undefined)),
	set: vi.fn(() => Promise.resolve()),
}))

const SCENE_READY_TIMEOUT_MS = 10_000

const QUARTER_TURN_RAD = Math.PI / 2
const MATRIX_PRECISION_DIGITS = 6
const MATRIX_TRANSLATION_X_INDEX = 12
const LOOP_WAIT_MS = 5000
const HALF_TURN_RAD = Math.PI

const ZERO_POSE = { x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 }

const part = (
	name: string,
	pose: Partial<typeof ZERO_POSE>,
	options: { kinematics?: Record<string, unknown>; physicalObject?: Geometry } = {}
): robotApi.FrameSystemConfig =>
	new robotApi.FrameSystemConfig({
		frame: new Transform({
			referenceFrame: name,
			poseInObserverFrame: new PoseInFrame({
				referenceFrame: 'world',
				pose: { ...ZERO_POSE, ...pose },
			}),
			physicalObject: options.physicalObject,
		}),
		kinematics: options.kinematics ? Struct.fromJson(options.kinematics as never) : undefined,
	})

/** One revolute joint about +Z between two boxed links. */
const armKinematics = (axis: { X: number; Y: number; Z: number }) => ({
	name: 'one-joint-arm',
	links: [
		{ id: 'base', parent: 'world', geometry: { x: 100, y: 100, z: 100 } },
		{
			id: 'tip',
			parent: 'waist',
			translation: { X: 0, Y: 0, Z: 200 },
			geometry: { x: 50, y: 50, z: 50 },
		},
	],
	joints: [{ id: 'waist', type: 'revolute', parent: 'base', axis, min: -360, max: 360 }],
})

const ARM = part('arm', {}, { kinematics: armKinematics({ X: 0, Y: 0, Z: 1 }) })

/** A prismatic joint carrying its own collider, the one kind of joint twin that draws. */
const GANTRY = part(
	'gantry',
	{ x: 1000 },
	{
		kinematics: {
			name: 'slide-gantry',
			links: [
				{ id: 'base', parent: 'world' },
				{ id: 'carriage', parent: 'slide', geometry: { x: 50, y: 50, z: 10 } },
			],
			joints: [
				{
					id: 'slide',
					type: 'prismatic',
					parent: 'base',
					axis: { X: 1, Y: 0, Z: 0 },
					min: 0,
					max: 300,
					geometry: { x: 80, y: 30, z: 20 },
				},
			],
		},
	}
)

const POST = part(
	'post',
	{ y: 1000 },
	{
		physicalObject: new Geometry({
			geometryType: {
				case: 'box',
				value: new RectangularPrism({ dimsMm: { x: 100, y: 100, z: 100 } }),
			},
		}),
	}
)

const FRAME_SYSTEM = [ARM, GANTRY, POST]

const ARM_PLAN: TrajectoryStep[] = [
	{ arm: [0] },
	{ arm: [QUARTER_TURN_RAD] },
	{ arm: [HALF_TURN_RAD] },
]
const ARM_PLAN_LAST_STEP = 2

const stepsFromLastStep = (steps: number[]): number[] => {
	const lastStepIndex = steps.indexOf(ARM_PLAN_LAST_STEP)
	return lastStepIndex === -1 ? [] : steps.slice(lastStepIndex)
}

const GANTRY_PLAN: TrajectoryStep[] = [{ gantry: [0] }, { gantry: [100] }, { gantry: [200] }]

const ARM_GHOSTS = ['preview:arm:tip', 'preview:arm:waist']
const GANTRY_GHOSTS = ['preview:gantry:carriage', 'preview:gantry:slide']

/** Every frame the free-space plan moves: the arm below its base, and all it carries. */
const XARM_FREE_SPACE_GHOSTS = [
	'preview:arm:base_top',
	'preview:arm:elbow',
	'preview:arm:forearm_rot',
	'preview:arm:gripper_mount',
	'preview:arm:gripper_rot',
	'preview:arm:lower_forearm',
	'preview:arm:shoulder',
	'preview:arm:upper_arm',
	'preview:arm:upper_forearm',
	'preview:arm:waist',
	'preview:arm:wrist',
	'preview:arm:wrist_link',
	'preview:cam',
	'preview:cam_origin',
	'preview:gripper:base',
	'preview:gripper:left_finger',
	'preview:gripper:left_joint',
	'preview:gripper:right_finger',
	'preview:gripper:right_joint',
	'preview:gripper:tcp',
	'preview:gripper_origin',
	'preview:tool',
	'preview:tool_origin',
]

type HostProps = Omit<Parameters<typeof TrajectoryPreviewHost>[1], 'onready'>

const mount = async (props: HostProps) => {
	let probe: TrajectoryPreviewProbeHandle | undefined
	const result = render(TrajectoryPreviewHost, {
		props: {
			...props,
			onready: (ready) => {
				probe = ready
			},
		},
	})

	await expect.poll(() => probe !== undefined, { timeout: SCENE_READY_TIMEOUT_MS }).toBe(true)
	if (!probe) throw new Error('the scene probe never reported')
	return { ...result, probe }
}

const ghosts = (world: World) => world.query(PreviewGhost)

const ghostNames = (world: World): string[] =>
	ghosts(world)
		.map((entity) => entity.get(traits.Name) ?? '')
		.toSorted()

const ghostNamed = (world: World, name: string) =>
	ghosts(world).find((entity) => entity.get(traits.Name) === name)

/** The waist twin's local rotation as where it sends +X, which a revolute joint about +Z turns. */
const waistXAxis = (world: World): [number, number] | undefined => {
	const elements = ghostNamed(world, 'preview:arm:waist')?.get(traits.Matrix)?.elements
	if (!elements) return undefined
	return [
		Number(elements[0].toFixed(MATRIX_PRECISION_DIGITS)),
		Number(elements[1].toFixed(MATRIX_PRECISION_DIGITS)),
	]
}

/**
 * Two entries where the first step has one, so the check for which components move compares
 * lengths and never reads an entry. Drawing the step reads the first entry, which throws.
 */
const jointValuesThatThrowOnRead = (): number[] => {
	const values = [0, 0]
	Object.defineProperty(values, 0, {
		get: () => {
			throw new Error('joint value unreadable')
		},
	})
	return values
}

/** The slide twin's local offset along the gantry axis, in meters. */
const slideOffset = (world: World): number | undefined => {
	const elements = ghostNamed(world, 'preview:gantry:slide')?.get(traits.Matrix)?.elements
	return elements === undefined
		? undefined
		: Number(elements[MATRIX_TRANSLATION_X_INDEX].toFixed(MATRIX_PRECISION_DIGITS))
}

afterEach(() => {
	setFrameSystem(undefined)
})

describe('TrajectoryPreview', () => {
	it('draws preview ghosts for a trajectory and none once it is undefined', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const { probe, rerender } = await mount({ trajectory: ARM_PLAN })

		await expect.poll(() => ghostNames(probe.world)).toEqual(ARM_GHOSTS)

		await rerender({ trajectory: undefined })

		await expect.poll(() => ghostNames(probe.world)).toEqual([])
	})

	it('draws a raw plan reply once parsePlanResult has turned it into steps', async () => {
		const xArmCase = frameSystemGoldenCases.find((goldenCase) => goldenCase.name.includes('xArm6'))
		if (!xArmCase) throw new Error('the golden file has no xArm6 scene')
		setFrameSystem(xArmCase.parts.map((json) => robotApi.FrameSystemConfig.fromJson(json as never)))
		const onError = vi.fn()

		const { trajectory } = parsePlanResult(planFreeSpace)
		const { probe } = await mount({ trajectory, onError })

		await expect.poll(() => ghostNames(probe.world)).toEqual(XARM_FREE_SPACE_GHOSTS)
		expect(onError).not.toHaveBeenCalled()
	})

	it('puts the ghost joint at the pose of the step the host sets while paused', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const { probe, rerender } = await mount({ trajectory: ARM_PLAN, playing: false })
		await expect.poll(() => waistXAxis(probe.world)).toEqual([1, 0])

		await rerender({ step: 1 })

		await expect.poll(() => waistXAxis(probe.world)).toEqual([0, 1])
	})

	it('reports every step it plays out through `step`, looping back to the first', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const steps: number[] = []

		await mount({ trajectory: ARM_PLAN, onStepChange: (step) => steps.push(step) })

		await expect
			.poll(() => stepsFromLastStep(steps), {
				timeout: LOOP_WAIT_MS,
				message: 'playback reaches the last step, then reports step 0 again',
			})
			.toContain(0)
	})

	it('reports a missing frame system through onError and draws nothing', async () => {
		const onError = vi.fn()
		const { probe } = await mount({ trajectory: ARM_PLAN, onError })

		await expect
			.poll(() => onError.mock.calls)
			.toEqual([['No frame system available to draw the plan against.']])
		expect(ghostNames(probe.world)).toEqual([])
	})

	it('waits for a frame system still loading, then draws against it', async () => {
		setFrameSystem(undefined, { isLoading: true })
		const onError = vi.fn()
		const { probe } = await mount({ trajectory: ARM_PLAN, onError })

		setFrameSystem(FRAME_SYSTEM)

		await expect.poll(() => ghostNames(probe.world)).toEqual(ARM_GHOSTS)
		expect(onError).not.toHaveBeenCalled()
	})

	it('reports a step that throws and keeps rendering frames', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const onError = vi.fn()
		const uncaught: string[] = []
		const recordUncaught = (event: ErrorEvent) => uncaught.push(event.message)
		window.addEventListener('error', recordUncaught)

		try {
			const { probe } = await mount({
				trajectory: [{ arm: [0] }, { arm: jointValuesThatThrowOnRead() }],
				onError,
			})

			await expect.poll(() => onError.mock.calls).toEqual([['joint value unreadable']])
			const renderedBefore = probe.renderedFrames()
			probe.invalidate()
			await expect.poll(() => probe.renderedFrames()).toBeGreaterThan(renderedBefore)
		} finally {
			window.removeEventListener('error', recordUncaught)
		}

		expect(uncaught).toEqual([])
	})

	it('reports a joint with a zero-length axis and leaves no ghosts behind', async () => {
		setFrameSystem([part('arm', {}, { kinematics: armKinematics({ X: 0, Y: 0, Z: 0 }) })])
		const onError = vi.fn()

		const { probe } = await mount({ trajectory: ARM_PLAN, onError })

		await expect
			.poll(() => onError.mock.calls)
			.toEqual([['joint "arm:waist" has a zero-length axis']])
		expect(ghostNames(probe.world)).toEqual([])
	})

	it('reports a trajectory naming only components the frame system lacks, drawing nothing', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const onError = vi.fn()

		const { probe } = await mount({
			trajectory: [{ 'missing-arm': [0] }, { 'missing-arm': [1] }],
			onError,
		})

		await expect
			.poll(() => onError.mock.calls)
			.toEqual([['No geometry in the frame system to draw this plan with.']])
		expect(ghostNames(probe.world)).toEqual([])
	})

	it('draws the known components of a trajectory that also names a missing one', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const onError = vi.fn()

		const { probe } = await mount({
			trajectory: [
				{ arm: [0], 'missing-arm': [0] },
				{ arm: [1], 'missing-arm': [1] },
			],
			onError,
		})

		await expect.poll(() => ghostNames(probe.world)).toEqual(ARM_GHOSTS)
		expect(onError).not.toHaveBeenCalled()
	})

	it('leaves no ghost of a trajectory replaced mid-play', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const { probe, rerender } = await mount({ trajectory: ARM_PLAN })
		await expect
			.poll(() => waistXAxis(probe.world), { message: 'playback moved off the first step' })
			.not.toEqual([1, 0])

		await rerender({ trajectory: GANTRY_PLAN })

		await expect.poll(() => ghostNames(probe.world)).toEqual(GANTRY_GHOSTS)
		await expect
			.poll(() => slideOffset(probe.world), { message: 'the new plan plays past its first step' })
			.toBeGreaterThan(0)
		expect(ghostNames(probe.world)).toEqual(GANTRY_GHOSTS)
	})

	it('keeps ghosts undimmed and visible while the scene focuses another frame', async () => {
		setFrameSystem(FRAME_SYSTEM)
		const { probe } = await mount({ frame: 'post', trajectory: GANTRY_PLAN })
		const obstacle = probe.world.spawn(traits.Name('obstacle'), traits.Box({ x: 1, y: 1, z: 1 }))

		await expect.poll(() => ghostNames(probe.world)).toEqual(GANTRY_GHOSTS)
		await expect
			.poll(() => obstacle.has(traits.Dimmed), { message: 'the focus dims what is outside it' })
			.toBe(true)
		const slide = ghostNamed(probe.world, 'preview:gantry:slide')
		expect(slide?.has(traits.Box), 'the slide twin draws a collider').toBe(true)
		expect(
			ghosts(probe.world).filter(
				(ghost) =>
					ghost.has(traits.Dimmed) ||
					ghost.has(traits.Invisible) ||
					ghost.has(traits.InheritedInvisible)
			)
		).toEqual([])
	})
})
