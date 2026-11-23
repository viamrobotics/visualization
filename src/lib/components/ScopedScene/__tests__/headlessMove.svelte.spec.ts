import type { TransformControls } from 'three/addons/controls/TransformControls.js'

import { Struct } from '@bufbuild/protobuf'
import { render } from '@testing-library/svelte'
import { MotionClient, PoseInFrame, robotApi, Transform } from '@viamrobotics/sdk'
import { type Object3D, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TrajectoryStep } from '#lib/motion/jointPose.js'

import { PreviewGhost } from '#lib/components/motion/previewGhostTrait.js'
import { traits } from '#lib/ecs/index.js'

import type { MoveTargetGizmoProbeHandle } from '../../motion/__tests__/__fixtures__/MoveTargetGizmoProbe.svelte'
import type { MoveTarget } from '../../motion/MoveTarget'

import { setFrameSystem } from '../../motion/__tests__/__fixtures__/TrajectoryPreviewFrameSystem.svelte'
import HeadlessMoveHost from './__fixtures__/HeadlessMoveHost.svelte'

vi.mock('@threlte/core/webgpu', (importOriginal) => importOriginal())
vi.mock('@threlte/extras/webgpu', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useConfigFrames.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useResourceByName.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFragmentInfo.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/usePartConfig.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useLinked.svelte.js', (importOriginal) => importOriginal())

const SCENE_READY_TIMEOUT_MS = 10_000

const liveEndEffector = vi.hoisted(() => ({
	pose: { x: 400, y: 100, z: 300, oX: 0, oY: 0, oZ: -1, theta: 0 },
}))

vi.mock('@viamrobotics/svelte-sdk', async (importOriginal) => {
	const sdk = await importOriginal<typeof import('@viamrobotics/svelte-sdk')>()
	const { frameSystemQuery } = await import(
		'../../motion/__tests__/__fixtures__/TrajectoryPreviewFrameSystem.svelte'
	)
	const createRobotQuery = (...args: unknown[]) => {
		if (args[1] === 'getPose') return { data: { pose: liveEndEffector.pose }, error: undefined }
		if (args[1] === 'frameSystemConfig') return frameSystemQuery
		return (sdk.createRobotQuery as (...queryArgs: unknown[]) => unknown)(...args)
	}
	return { ...sdk, createRobotQuery: createRobotQuery as typeof sdk.createRobotQuery }
})

vi.mock('idb-keyval', () => ({
	get: vi.fn(() => Promise.resolve(undefined)),
	set: vi.fn(() => Promise.resolve()),
}))

const FRAME = 'arm'

const DRAG_STEP_PX = 12

const ARM = new robotApi.FrameSystemConfig({
	frame: new Transform({
		referenceFrame: FRAME,
		poseInObserverFrame: new PoseInFrame({
			referenceFrame: 'world',
			pose: { x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 },
		}),
	}),
	kinematics: Struct.fromJson({
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
		joints: [
			{
				id: 'waist',
				type: 'revolute',
				parent: 'base',
				axis: { X: 0, Y: 0, Z: 1 },
				min: -360,
				max: 360,
			},
		],
	}),
})

const QUARTER_TURN_RAD = Math.PI / 2

const ARM_PLAN: TrajectoryStep[] = [{ [FRAME]: [0] }, { [FRAME]: [QUARTER_TURN_RAD] }]

const ARM_GHOSTS = ['preview:arm:tip', 'preview:arm:waist']

interface ScreenPoint {
	x: number
	y: number
}

const findTransformControls = (
	probe: MoveTargetGizmoProbeHandle
): TransformControls | undefined => {
	let found: TransformControls | undefined
	probe.scene.traverse((object) => {
		if ('isTransformControlsRoot' in object) {
			found = (object as unknown as { controls: TransformControls }).controls
		}
	})
	return found
}

const handleScreenPoint = (probe: MoveTargetGizmoProbeHandle): ScreenPoint => {
	const controls = findTransformControls(probe)
	if (!controls) throw new Error('the gizmo mounted no transform controls')
	const handle: Object3D | undefined = controls.object
	if (!handle) throw new Error('the transform controls hold no object')
	const camera = probe.camera()
	camera.updateMatrixWorld()
	controls.getHelper().updateMatrixWorld()

	const normalizedDeviceCoordinates = handle.getWorldPosition(new Vector3()).project(camera)
	const boundingRect = probe.dom.getBoundingClientRect()
	return {
		x: boundingRect.left + ((normalizedDeviceCoordinates.x + 1) / 2) * boundingRect.width,
		y: boundingRect.top + ((1 - normalizedDeviceCoordinates.y) / 2) * boundingRect.height,
	}
}

const MOUSE_POINTER_ID = 1
const PRIMARY_BUTTON = 0
const NO_BUTTON_CHANGE = -1
const PRIMARY_HELD = 1
const NONE_HELD = 0

const pointerEvent = (type: string, point: ScreenPoint, buttons: number, button: number) =>
	new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		composed: true,
		pointerId: MOUSE_POINTER_ID,
		pointerType: 'mouse',
		isPrimary: true,
		clientX: point.x,
		clientY: point.y,
		button,
		buttons,
	})

/** Presses on the handle, moves it right twice, and lets go. */
const dragHandle = (probe: MoveTargetGizmoProbeHandle) => {
	const start = handleScreenPoint(probe)
	const at = (steps: number) => ({ x: start.x + DRAG_STEP_PX * steps, y: start.y })

	probe.dom.dispatchEvent(pointerEvent('pointerdown', start, PRIMARY_HELD, PRIMARY_BUTTON))
	probe.dom.dispatchEvent(pointerEvent('pointermove', at(1), PRIMARY_HELD, NO_BUTTON_CHANGE))
	probe.dom.dispatchEvent(pointerEvent('pointermove', at(2), PRIMARY_HELD, NO_BUTTON_CHANGE))
	probe.dom.dispatchEvent(pointerEvent('pointerup', at(2), NONE_HELD, PRIMARY_BUTTON))
}

const ghostNames = (probe: MoveTargetGizmoProbeHandle): string[] =>
	probe.world
		.query(PreviewGhost)
		.map((entity) => entity.get(traits.Name) ?? '')
		.toSorted()

afterEach(() => {
	setFrameSystem(undefined)
})

describe('a headless move in ScopedScene, with no MoveFrame plugin', () => {
	it('drags a target and previews a trajectory without ever calling the motion service', async () => {
		setFrameSystem([ARM])
		const move = vi.spyOn(MotionClient.prototype, 'move')
		const doCommand = vi.spyOn(MotionClient.prototype, 'doCommand')
		const onDrag = vi.fn<(target: MoveTarget) => void>()
		const onRelease = vi.fn<(target: MoveTarget) => void>()
		let probe: MoveTargetGizmoProbeHandle | undefined

		try {
			const { rerender } = render(HeadlessMoveHost, {
				props: {
					frame: FRAME,
					trajectory: undefined,
					onDrag,
					onRelease,
					onready: (ready) => {
						probe = ready
					},
				},
			})
			await expect.poll(() => probe !== undefined, { timeout: SCENE_READY_TIMEOUT_MS }).toBe(true)
			if (!probe) throw new Error('the scene probe never reported')
			const ready = probe
			await expect
				.poll(() => findTransformControls(ready) !== undefined, { timeout: SCENE_READY_TIMEOUT_MS })
				.toBe(true)

			dragHandle(ready)

			expect(onDrag, 'one call per pointer move').toHaveBeenCalledTimes(2)
			expect(onRelease, 'one call on pointer up').toHaveBeenCalledTimes(1)
			expect(onRelease).toHaveBeenCalledWith(onDrag.mock.calls.at(-1)?.[0])

			await rerender({ trajectory: ARM_PLAN })
			await expect
				.poll(() => ghostNames(ready), { message: 'the trajectory draws' })
				.toEqual(ARM_GHOSTS)

			await rerender({ trajectory: undefined })
			await expect.poll(() => ghostNames(ready), { message: 'undefined clears it' }).toEqual([])

			expect(move).not.toHaveBeenCalled()
			expect(doCommand).not.toHaveBeenCalled()
		} finally {
			move.mockRestore()
			doCommand.mockRestore()
		}
	})
})
