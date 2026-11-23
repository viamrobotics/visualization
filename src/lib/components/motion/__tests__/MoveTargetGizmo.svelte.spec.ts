import type { World } from 'koota'
import type { TransformControls } from 'three/addons/controls/TransformControls.js'

import { render } from '@testing-library/svelte'
import { MotionClient } from '@viamrobotics/sdk'
import { tick } from 'svelte'
import { Matrix4, type Object3D, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { relations, traits } from '#lib/ecs/index.js'

import type { MoveTarget } from '../MoveTarget'
import type { MoveTargetGizmoProbeHandle } from './__fixtures__/MoveTargetGizmoProbe.svelte'

import MoveTargetGizmoHost from './__fixtures__/MoveTargetGizmoHost.svelte'

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
	const createRobotQuery = (...args: unknown[]) =>
		args[1] === 'getPose'
			? { data: { pose: liveEndEffector.pose }, error: undefined }
			: (sdk.createRobotQuery as (...queryArgs: unknown[]) => unknown)(...args)
	return { ...sdk, createRobotQuery: createRobotQuery as typeof sdk.createRobotQuery }
})

vi.mock('idb-keyval', () => ({
	get: vi.fn(() => Promise.resolve(undefined)),
	set: vi.fn(() => Promise.resolve()),
}))

const FRAME = 'arm-1'

const MM_TO_M = 0.001

const STAGED_TARGET: MoveTarget = {
	referenceFrame: 'world',
	pose: { x: 250, y: -150, z: 420, oX: 0.6, oY: 0, oZ: 0.8, theta: 35 },
}

const HOST_WRITTEN_TARGET: MoveTarget = {
	referenceFrame: 'world',
	pose: { x: -300, y: 500, z: 150, oX: 0, oY: 0, oZ: 1, theta: 0 },
}

const LATER_HOST_WRITTEN_TARGET: MoveTarget = {
	referenceFrame: 'world',
	pose: { x: 100, y: 450, z: 200, oX: 0, oY: 0, oZ: 1, theta: 0 },
}

const ROUND_TRIP_DIGITS = 6

const ROUND_TRIP_DERIVATION =
	'float64 rounding through meters and the quaternion is near 1e-12, so 6 digits leaves margin while a 1000x or 57.3x units slip fails'

const POSE_FIELDS = ['x', 'y', 'z', 'oX', 'oY', 'oZ', 'theta'] as const

const DRAG_STEP_PX = 12

const ORBIT_START_INSET_PX = 40
const ORBIT_TRAVEL_PX = 120

const ORBIT_MIN_TRAVEL_M = 0.01

type HostProps = Omit<Parameters<typeof MoveTargetGizmoHost>[1], 'frame' | 'onready'>

interface ScreenPoint {
	x: number
	y: number
}

const findTransformControls = (scene: Object3D): TransformControls | undefined => {
	let found: TransformControls | undefined
	scene.traverse((object) => {
		if ('isTransformControlsRoot' in object) {
			found = (object as unknown as { controls: TransformControls }).controls
		}
	})
	return found
}

const transformControlsIn = (probe: MoveTargetGizmoProbeHandle): TransformControls => {
	const controls = findTransformControls(probe.scene)
	if (!controls) throw new Error('the gizmo mounted no transform controls')
	return controls
}

const handleObject = (probe: MoveTargetGizmoProbeHandle): Object3D => {
	const object = transformControlsIn(probe).object
	if (!object) throw new Error('the transform controls hold no object')
	return object
}

const mount = async (props: HostProps = {}) => {
	let probe: MoveTargetGizmoProbeHandle | undefined
	const result = render(MoveTargetGizmoHost, {
		props: {
			frame: FRAME,
			...props,
			onready: (ready) => {
				probe = ready
			},
		},
	})

	await expect.poll(() => probe !== undefined, { timeout: SCENE_READY_TIMEOUT_MS }).toBe(true)
	if (!probe) throw new Error('the scene probe never reported')
	const ready = probe

	if (props.isGizmoMounted !== false && !props.disabled) {
		await expect
			.poll(() => findTransformControls(ready.scene) !== undefined, {
				timeout: SCENE_READY_TIMEOUT_MS,
			})
			.toBe(true)
	}

	return { ...result, probe: ready }
}

const handleScreenPoint = (probe: MoveTargetGizmoProbeHandle): ScreenPoint => {
	const controls = transformControlsIn(probe)
	const camera = probe.camera()
	camera.updateMatrixWorld()
	controls.getHelper().updateMatrixWorld()

	const ndc = handleObject(probe).getWorldPosition(new Vector3()).project(camera)
	const rect = probe.dom.getBoundingClientRect()
	return {
		x: rect.left + ((ndc.x + 1) / 2) * rect.width,
		y: rect.top + ((1 - ndc.y) / 2) * rect.height,
	}
}

const MOUSE_POINTER_ID = 1

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

const PRIMARY_BUTTON = 0
const NO_BUTTON_CHANGE = -1
const PRIMARY_HELD = 1
const NONE_HELD = 0

const press = (dom: HTMLElement, point: ScreenPoint) =>
	dom.dispatchEvent(pointerEvent('pointerdown', point, PRIMARY_HELD, PRIMARY_BUTTON))

const dragTo = (dom: HTMLElement, point: ScreenPoint) =>
	dom.dispatchEvent(pointerEvent('pointermove', point, PRIMARY_HELD, NO_BUTTON_CHANGE))

const lift = (dom: HTMLElement, point: ScreenPoint) =>
	dom.dispatchEvent(pointerEvent('pointerup', point, NONE_HELD, PRIMARY_BUTTON))

const offset = (point: ScreenPoint, dx: number, dy = 0): ScreenPoint => ({
	x: point.x + dx,
	y: point.y + dy,
})

const metersOf = (target: MoveTarget) =>
	[target.pose.x, target.pose.y, target.pose.z].map((millimeters) => millimeters * MM_TO_M)

const stageArmWithGripper = (world: World) => {
	const arm = world.spawn(
		traits.Name(FRAME),
		traits.FramesAPI,
		traits.Matrix(new Matrix4().makeTranslation(0.4, 0.1, 0.3))
	)
	const gripper = world.spawn(
		traits.Name('gripper'),
		traits.FramesAPI,
		traits.Box({ x: 50, y: 50, z: 50 }),
		traits.Matrix(new Matrix4()),
		relations.ChildOf(arm)
	)
	const obstacle = world.spawn(traits.Name('obstacle'), traits.Box({ x: 100, y: 100, z: 100 }))
	return { gripper, obstacle }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const orbitCamera = async (probe: MoveTargetGizmoProbeHandle) => {
	const before = probe.camera().position.clone()
	const rect = probe.dom.getBoundingClientRect()
	const start = { x: rect.left + ORBIT_START_INSET_PX, y: rect.top + ORBIT_START_INSET_PX }
	const end = offset(start, ORBIT_TRAVEL_PX, ORBIT_TRAVEL_PX)

	press(probe.dom, start)
	await nextFrame()
	dragTo(probe.dom, offset(start, ORBIT_TRAVEL_PX / 2, ORBIT_TRAVEL_PX / 2))
	await nextFrame()
	dragTo(probe.dom, end)
	await nextFrame()
	lift(probe.dom, end)

	await expect
		.poll(() => probe.camera().position.distanceTo(before))
		.toBeGreaterThan(ORBIT_MIN_TRAVEL_M)
}

describe('MoveTargetGizmo', () => {
	it('fires onDrag once per pointer move and onRelease once on pointer up, each with a world target', async () => {
		const onDrag = vi.fn<(target: MoveTarget) => void>()
		const onRelease = vi.fn<(target: MoveTarget) => void>()
		const { probe } = await mount({ onDrag, onRelease })
		const start = handleScreenPoint(probe)
		const moves = [1, 2, 3].map((step) => offset(start, DRAG_STEP_PX * step))

		press(probe.dom, start)
		for (const point of moves) dragTo(probe.dom, point)
		lift(probe.dom, offset(start, DRAG_STEP_PX * moves.length))

		const plainWorldTarget = {
			referenceFrame: 'world',
			pose: Object.fromEntries(POSE_FIELDS.map((field) => [field, expect.any(Number)])),
		}
		expect(onDrag.mock.calls.map(([target]) => target)).toStrictEqual([
			plainWorldTarget,
			plainWorldTarget,
			plainWorldTarget,
		])
		expect(onRelease).toHaveBeenCalledTimes(1)
		expect(onRelease).toHaveBeenCalledWith(onDrag.mock.calls.at(-1)?.[0])
	})

	it('places the handle on the live end effector, in meters, while no target is staged', async () => {
		const { probe } = await mount()

		expect(handleObject(probe).position.toArray()).toEqual(
			metersOf({ referenceFrame: 'world', pose: liveEndEffector.pose })
		)
	})

	it('places the handle on a staged target, converted from millimeters to meters', async () => {
		const { probe } = await mount({ target: STAGED_TARGET })

		const position = handleObject(probe).position.toArray()
		for (const [index, meters] of metersOf(STAGED_TARGET).entries()) {
			expect(position[index], `axis ${index}: ${ROUND_TRIP_DERIVATION}`).toBeCloseTo(
				meters,
				ROUND_TRIP_DIGITS
			)
		}
	})

	it('reads a staged target back unchanged after a zero-movement drag', async () => {
		const onRelease = vi.fn<(target: MoveTarget) => void>()
		const { probe } = await mount({ target: STAGED_TARGET, onRelease })
		const start = handleScreenPoint(probe)

		press(probe.dom, start)
		dragTo(probe.dom, start)
		lift(probe.dom, start)

		expect(onRelease).toHaveBeenCalledTimes(1)
		const [released] = onRelease.mock.calls[0]
		expect(released.referenceFrame).toBe('world')
		for (const field of POSE_FIELDS) {
			expect(released.pose[field], `${field}: ${ROUND_TRIP_DERIVATION}`).toBeCloseTo(
				STAGED_TARGET.pose[field],
				ROUND_TRIP_DIGITS
			)
		}
	})

	it('keeps the handle under the pointer when the host writes the target mid-drag', async () => {
		const { probe, rerender } = await mount({ target: STAGED_TARGET })
		const start = handleScreenPoint(probe)
		const handle = handleObject(probe)

		press(probe.dom, start)
		dragTo(probe.dom, offset(start, DRAG_STEP_PX))
		const dragged = handle.position.toArray()

		await rerender({ target: HOST_WRITTEN_TARGET })
		await tick()

		expect(handle.position.toArray()).toEqual(dragged)

		lift(probe.dom, offset(start, DRAG_STEP_PX))
		await rerender({ target: LATER_HOST_WRITTEN_TARGET })
		await tick()

		const position = handle.position.toArray()
		for (const [index, meters] of metersOf(LATER_HOST_WRITTEN_TARGET).entries()) {
			expect(
				position[index],
				`axis ${index}: a host write after the drag moves the handle`
			).toBeCloseTo(meters, ROUND_TRIP_DIGITS)
		}
	})

	it('releases the camera controls when disabled mid-drag, so the camera can orbit', async () => {
		const { probe, rerender } = await mount()

		press(probe.dom, handleScreenPoint(probe))
		expect(probe.isTransformControlsActive(), 'the drag parked the camera controls').toBe(true)

		await rerender({ disabled: true })
		await tick()

		expect(findTransformControls(probe.scene), 'the handles are hidden').toBeUndefined()
		expect(probe.isTransformControlsActive()).toBe(false)
		await orbitCamera(probe)
	})

	it('releases the camera controls when unmounted mid-drag', async () => {
		const { probe, rerender } = await mount()

		press(probe.dom, handleScreenPoint(probe))
		expect(probe.isTransformControlsActive(), 'the drag parked the camera controls').toBe(true)

		await rerender({ isGizmoMounted: false })
		await tick()

		expect(probe.isTransformControlsActive()).toBe(false)
	})

	it('mounts in ScopedScene with no plugin and logs no missing-context error', async () => {
		const consoleError = vi.spyOn(console, 'error')
		const logged: string[] = []
		consoleError.mockImplementation((...args: unknown[]) => {
			logged.push(args.map(String).join(' '))
		})
		const uncaught: string[] = []
		const recordUncaught = (event: ErrorEvent) => uncaught.push(event.message)
		window.addEventListener('error', recordUncaught)

		try {
			const { probe } = await mount()
			const start = handleScreenPoint(probe)
			press(probe.dom, start)
			dragTo(probe.dom, offset(start, DRAG_STEP_PX))
			lift(probe.dom, offset(start, DRAG_STEP_PX))
			await tick()
		} finally {
			window.removeEventListener('error', recordUncaught)
			consoleError.mockRestore()
		}

		expect(uncaught).toEqual([])
		expect(logged.filter((message) => /context/i.test(message))).toEqual([])
	})

	it('never calls the motion service across a drag', async () => {
		const move = vi.spyOn(MotionClient.prototype, 'move')
		const doCommand = vi.spyOn(MotionClient.prototype, 'doCommand')
		const onRelease = vi.fn<(target: MoveTarget) => void>()

		try {
			const { probe } = await mount({ onRelease })
			const start = handleScreenPoint(probe)
			press(probe.dom, start)
			dragTo(probe.dom, offset(start, DRAG_STEP_PX))
			lift(probe.dom, offset(start, DRAG_STEP_PX))
			await tick()

			expect(onRelease, 'the drag happened').toHaveBeenCalledTimes(1)
			expect(move).not.toHaveBeenCalled()
			expect(doCommand).not.toHaveBeenCalled()
		} finally {
			move.mockRestore()
			doCommand.mockRestore()
		}
	})

	it('leaves the target ghosts undimmed while the scene is focused on the gizmo frame', async () => {
		const { probe, rerender } = await mount()
		const { gripper, obstacle } = stageArmWithGripper(probe.world)
		await expect.poll(() => gripper.has(traits.WorldMatrix)).toBe(true)

		await rerender({ target: STAGED_TARGET })

		const ghosts = () =>
			probe.world
				.query(traits.NonSelectable, traits.Box)
				.filter((entity) => !entity.has(traits.Name))
		await expect
			.poll(() => ghosts().length, { message: 'the staged target ghosts the gripper' })
			.toBe(1)
		await expect
			.poll(() => obstacle.has(traits.Dimmed), { message: 'the focus dims what is outside it' })
			.toBe(true)
		expect(ghosts().filter((ghost) => ghost.has(traits.Dimmed))).toEqual([])
	})
})
