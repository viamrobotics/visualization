import type { JsonValue } from '@bufbuild/protobuf'
import type { Entity } from 'koota'

import { Struct } from '@bufbuild/protobuf'
import { PoseInFrame, robotApi, Transform } from '@viamrobotics/sdk'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { parsePlan } from '$lib/plugins/MotionPlanReplayer/parse-plan'

import planJson from '../../MotionPlanReplayer/__tests__/__fixtures__/plan.json?raw'
import { parseMoveOptions } from '../parseMoveOptions'
import { liveFrameName } from '../previewNames'
import { PreviewGhost } from '../traits'
import { previewFrameIntervalMs } from '../usePreviewMove.svelte'
import {
	createPreviewMoveHarness,
	type PreviewMoveHarness,
} from './__fixtures__/previewMoveHarness.svelte'

const dump = parsePlan(planJson)

/** A part's `kinematics` is the same `ModelConfigJSON` a dump nests under `frame.model`. */
const kinematicsFromDump = (partName: string): Struct => {
	const entry = dump.frames[partName]
	if (!entry || entry.frame_type !== 'model') {
		throw new Error(`fixture has no model frame named "${partName}"`)
	}
	return Struct.fromJson((entry.frame as { model: Record<string, unknown> }).model as never)
}

const part = (name: string, kinematics: Struct): robotApi.FrameSystemConfig =>
	new robotApi.FrameSystemConfig({
		frame: new Transform({
			referenceFrame: name,
			poseInObserverFrame: new PoseInFrame({
				referenceFrame: 'world',
				pose: { x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 },
			}),
		}),
		kinematics,
	})

const ARM = part('left-arm', kinematicsFromDump('left-arm'))

/** Joints and a link, no shapes: plenty of descriptors and nothing a twin could be drawn from. */
const SHAPELESS = part(
	'left-arm',
	Struct.fromJson({
		name: 'shapeless',
		links: [
			{ id: 'base', parent: 'world' },
			{ id: 'tip', parent: 'waist' },
		],
		joints: [{ id: 'waist', type: 'revolute', parent: 'base', axis: { X: 0, Y: 0, Z: 1 } }],
	} as never)
)

/** Two distinct configurations, so it never reads as "already at the goal". */
const PLAN_REPLY: JsonValue = {
	plan: [{ 'left-arm': [0, 0, 0, 0, 0, 0] }, { 'left-arm': [1, 0, 0, 0, 0, 0] }],
}

let harness: PreviewMoveHarness | undefined

const setup = (parts = [ARM]) => {
	harness = createPreviewMoveHarness(parts)
	return harness
}

afterEach(() => {
	harness?.destroy()
	harness = undefined
})

const twins = (previewHarness: PreviewMoveHarness) => [...previewHarness.world.query(PreviewGhost)]

/** `traits.Geometry` resolves to one of these, so drawing is what having one of them means. */
const SHAPES = [traits.Box, traits.Capsule, traits.Sphere, traits.BufferGeometry] as const

const draws = (entity: Entity | undefined) =>
	entity !== undefined && SHAPES.some((shape) => entity.has(shape))

const twinNames = (previewHarness: PreviewMoveHarness) =>
	twins(previewHarness)
		.map((entity) => entity.get(traits.Name) ?? '')
		.toSorted()

const twinNamed = (previewHarness: PreviewMoveHarness, name: string) =>
	twins(previewHarness).find((entity) => entity.get(traits.Name) === name)

const planned = async (previewHarness: PreviewMoveHarness, reply: JsonValue = PLAN_REPLY) => {
	const done = previewHarness.preview.requestPreview()
	previewHarness.pending[0]!.resolve(reply)
	await done
}

describe('a preview that resolves', () => {
	it('arms the panel with the trajectory the planner returned', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.resolve(PLAN_REPLY)
		await done

		expect(previewHarness.preview.status).toBe('ready')
		expect(previewHarness.preview.trajectory).toEqual([
			{ 'left-arm': [0, 0, 0, 0, 0, 0] },
			{ 'left-arm': [1, 0, 0, 0, 0, 0] },
		])
		expect(previewHarness.preview.plannedSteps).toBe(2)
	})

	it('reports planning while the request is open', () => {
		const previewHarness = setup()

		void previewHarness.preview.requestPreview()

		expect(previewHarness.preview.status).toBe('planning')
	})
})

describe('a preview the motion service refuses', () => {
	it('reports the reason the service gave', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.reject(new Error('no plan found within the constraints'))
		await done

		expect(previewHarness.preview.status).toBe('error')
		expect(previewHarness.preview.message).toBe('no plan found within the constraints')
	})

	it('names the frame when the failure carries no message', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.reject('not an Error')
		await done

		expect(previewHarness.preview.message).toBe('Failed to plan a move for "left-arm".')
	})

	it('reports an unreadable reply rather than arming an empty preview', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.resolve({ plan: [] })
		await done

		expect(previewHarness.preview.status).toBe('error')
		expect(previewHarness.preview.trajectory).toEqual([])
	})
})

describe('a preview whose goal moved while it was in flight', () => {
	it('discards the answer instead of arming the panel with it', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.invalidate()
		expect(previewHarness.preview.status).toBe('idle')

		previewHarness.pending[0]!.resolve(PLAN_REPLY)
		await done

		expect(previewHarness.preview.status).toBe('idle')
		expect(previewHarness.preview.trajectory).toEqual([])
	})

	it('cancels the request rather than letting it run to completion', () => {
		const previewHarness = setup()

		void previewHarness.preview.requestPreview()
		expect(previewHarness.pending[0]!.signal?.aborted).toBe(false)

		previewHarness.invalidate()

		expect(previewHarness.pending[0]!.signal?.aborted).toBe(true)
	})

	it('keeps a discarded request’s failure off the panel', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.invalidate()
		previewHarness.pending[0]!.reject(new Error('planning failed'))
		await done

		expect(previewHarness.preview.status).toBe('idle')
		expect(previewHarness.preview.message).toBeUndefined()
	})
})

describe('a preview whose panel closed while it was in flight', () => {
	it('cancels the request rather than letting it run to completion', () => {
		const previewHarness = setup()

		void previewHarness.preview.requestPreview()

		previewHarness.dispose()

		expect(previewHarness.pending[0]!.signal?.aborted).toBe(true)
	})
})

describe('a goal the machine is already at', () => {
	/** RDK's answer for "nothing to do": the start configuration written twice. */
	const AT_GOAL: JsonValue = {
		plan: [{ 'left-arm': [1, 0, 0, 0, 0, 0] }, { 'left-arm': [1, 0, 0, 0, 0, 0] }],
	}

	it('reports it as its own outcome rather than as a failure', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.resolve(AT_GOAL)
		await done

		expect(previewHarness.preview.status).toBe('already-at-goal')
		expect(previewHarness.preview.message).toMatch(/already at the target/i)
	})

	it('arms nothing', async () => {
		const previewHarness = setup()

		const done = previewHarness.preview.requestPreview()
		previewHarness.pending[0]!.resolve(AT_GOAL)
		await done

		expect(previewHarness.preview.trajectory).toEqual([])
		expect(previewHarness.preview.plannedSteps).toBe(0)
	})
})

describe('the request the panel sends', () => {
	it('names the frame it is open on and the service it selected', () => {
		const previewHarness = setup()

		void previewHarness.preview.requestPreview()

		const request = JSON.parse(previewHarness.pending[0]!.command.plan as string) as Record<
			string,
			unknown
		>
		expect(request.componentName).toBe('left-arm')
		expect(request.name).toBe('builtin')
	})

	/**
	 * The only case that builds its own `moveOptions`: on the harness default of two `undefined`s,
	 * forwarded and silently dropped look identical, so no other test here can tell them apart.
	 */
	it('passes through the world state and constraints the panel parsed', () => {
		harness = createPreviewMoveHarness([ARM], {
			moveOptions: () =>
				parseMoveOptions(
					'{"obstacles":[{"referenceFrame":"world","geometries":[{"sphere":{"radiusMm":50}}]}]}',
					'{"linearConstraint":[{"lineToleranceMm":5}]}'
				),
		})
		const previewHarness = harness

		void previewHarness.preview.requestPreview()

		const request = JSON.parse(previewHarness.pending[0]!.command.plan as string) as Record<
			string,
			unknown
		>
		expect(request.worldState).toEqual({
			obstacles: [{ referenceFrame: 'world', geometries: [{ sphere: { radiusMm: 50 } }] }],
		})
		expect(request.constraints).toEqual({ linearConstraint: [{ lineToleranceMm: 5 }] })
	})
})

describe('the twins a preview draws', () => {
	/**
	 * `left-arm` in the dump is 14 frames: `left-arm_origin` and `left-arm:base` sit above the first
	 * joint, so the machine already has them where the plan leaves them.
	 */
	it('twins the frames the plan moves and leaves the ones above the first joint alone', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		expect(twins(previewHarness)).toHaveLength(12)
		expect(twinNames(previewHarness)).not.toContain('preview:left-arm_origin')
		expect(twinNames(previewHarness)).not.toContain('preview:left-arm:base')
		expect(twinNames(previewHarness)).toContain('preview:left-arm:waist')
		expect(twinNames(previewHarness)).toContain('preview:left-arm:gripper_mount')
	})

	it('hangs the chain off the live frame the plan holds still', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		const anchors = twins(previewHarness)
			.map((entity) => entity.get(traits.Orphan))
			.filter((parent): parent is string => parent !== undefined && !parent.startsWith('preview:'))

		expect(anchors).toEqual(['left-arm:base'])
	})

	it('names every twin after the live frame it mirrors', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		const mirrored = twinNames(previewHarness).map((name) => liveFrameName(name))
		expect(mirrored).toContain('left-arm:waist')
		expect(mirrored.every((name) => !name.startsWith('preview:'))).toBe(true)
	})

	it('draws only the twins that carry geometry', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		const drawn = twins(previewHarness).filter((entity) => draws(entity))
		expect(drawn).toHaveLength(6)
	})

	it('gives a joint a transform to carry and nothing to draw', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		const waist = twins(previewHarness).find(
			(entity) => entity.get(traits.Name) === 'preview:left-arm:waist'
		)
		expect(waist?.has(traits.Matrix)).toBe(true)
		expect(draws(waist)).toBe(false)
	})

	it('keeps every twin out of the selection', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		expect(twins(previewHarness).every((entity) => entity.has(traits.NonSelectable))).toBe(true)
	})

	it('drops every twin when the preview is cleared', async () => {
		const previewHarness = setup()
		await planned(previewHarness)

		previewHarness.preview.clear()

		expect(twins(previewHarness)).toHaveLength(0)
	})

	it('drops every twin when the panel unmounts', async () => {
		const previewHarness = setup()
		await planned(previewHarness)

		previewHarness.dispose()

		expect(twins(previewHarness)).toHaveLength(0)
	})
})

describe('a hidden frame', () => {
	it('still carries its transform, so the frames below it stay put', async () => {
		const previewHarness = setup()
		previewHarness.world.spawn(traits.Name('left-arm:upper_arm'), traits.Invisible)

		await planned(previewHarness)

		const twin = twins(previewHarness).find(
			(entity) => entity.get(traits.Name) === 'preview:left-arm:upper_arm'
		)
		expect(twin?.has(traits.Matrix)).toBe(true)
		expect(draws(twin)).toBe(false)
	})
})

describe('a frame system with nothing to draw', () => {
	it.each([
		['no parts at all', [] as robotApi.FrameSystemConfig[], /no frame system/i],
		['parts whose frames carry no geometry', [SHAPELESS], /no geometry/i],
	])('reports %s rather than arming an empty preview', async (_label, parts, message) => {
		const previewHarness = setup(parts)

		await planned(previewHarness)

		expect(previewHarness.preview.status).toBe('error')
		expect(previewHarness.preview.message).toMatch(message)
		expect(twins(previewHarness)).toHaveLength(0)
	})
})

describe('scrubbing the preview', () => {
	it('walks one frame per configuration the planner returned', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		expect(previewHarness.preview.player.totalSteps).toBe(2)
	})

	it('moves the joints and leaves the static frames where they were', async () => {
		const previewHarness = setup()
		await planned(previewHarness)
		const waist = twinNamed(previewHarness, 'preview:left-arm:waist')!
		const link = twinNamed(previewHarness, 'preview:left-arm:base_top')!
		const waistBefore = waist.get(traits.Matrix)!.clone()
		const linkBefore = link.get(traits.Matrix)!.clone()

		previewHarness.preview.player.seek(1)

		expect(waist.get(traits.Matrix)!.equals(waistBefore)).toBe(false)
		expect(link.get(traits.Matrix)!.equals(linkBefore)).toBe(true)
	})

	it('returns to the pose it drew first when scrubbed back to the start', async () => {
		const previewHarness = setup()
		await planned(previewHarness)
		const waist = twinNamed(previewHarness, 'preview:left-arm:waist')!
		const atStart = waist.get(traits.Matrix)!.clone()

		previewHarness.preview.player.seek(1)
		previewHarness.preview.player.seek(0)

		expect(waist.get(traits.Matrix)!.equals(atStart)).toBe(true)
	})

	it('parks playback when the preview is cleared', async () => {
		const previewHarness = setup()
		await planned(previewHarness)
		previewHarness.preview.player.seek(1)

		previewHarness.preview.clear()

		expect(previewHarness.preview.player.currentStep).toBe(0)
		expect(previewHarness.preview.player.totalSteps).toBe(0)
	})
})

describe('what the scrubber walks', () => {
	it('plays one frame per planned configuration by default', async () => {
		const previewHarness = setup()

		await planned(previewHarness)

		expect(previewHarness.preview.detail).toBe('waypoints')
		expect(previewHarness.preview.player.totalSteps).toBe(2)
		expect(previewHarness.preview.waypointIndices).toEqual([0, 1])
	})

	it('fills in frames between the waypoints when asked to interpolate', async () => {
		const previewHarness = setup()
		await planned(previewHarness)

		previewHarness.preview.detail = 'interpolated'

		expect(previewHarness.preview.player.totalSteps).toBeGreaterThan(2)
		expect(previewHarness.preview.plannedSteps).toBe(2)
	})

	it('marks which of the played frames are planned waypoints', async () => {
		const previewHarness = setup()
		await planned(previewHarness)

		previewHarness.preview.detail = 'interpolated'

		const marks = previewHarness.preview.waypointIndices
		expect(marks[0]).toBe(0)
		expect(marks.at(-1)).toBe(previewHarness.preview.player.lastStep)
		expect(marks).toHaveLength(2)
	})

	it('keeps handing execute the plan rather than the frames it played', async () => {
		const previewHarness = setup()
		await planned(previewHarness)

		previewHarness.preview.detail = 'interpolated'

		expect(previewHarness.preview.trajectory).toEqual([
			{ 'left-arm': [0, 0, 0, 0, 0, 0] },
			{ 'left-arm': [1, 0, 0, 0, 0, 0] },
		])
	})

	it('restarts playback, since a frame index does not carry across the two framings', async () => {
		const previewHarness = setup()
		await planned(previewHarness)
		previewHarness.preview.player.seek(1)

		previewHarness.preview.detail = 'interpolated'

		expect(previewHarness.preview.player.currentStep).toBe(0)
	})

	it('leaves playback alone when the framing already in effect is reselected', async () => {
		const previewHarness = setup()
		await planned(previewHarness)
		previewHarness.preview.player.seek(1)

		previewHarness.preview.detail = 'waypoints'

		expect(previewHarness.preview.player.currentStep).toBe(1)
	})
})

describe('previewFrameIntervalMs', () => {
	it.each([
		{ frames: 2, expected: 250 },
		{ frames: 5, expected: 250 },
		{ frames: 17, expected: 250 },
	])(
		'holds a $frames frame plan at $expected ms rather than stretching it',
		({ frames, expected }) => {
			expect(previewFrameIntervalMs(frames)).toBe(expected)
		}
	)

	it('divides the duration target once a plan has frames enough to fill it', () => {
		expect(previewFrameIntervalMs(96)).toBeCloseTo(42.105, 3)
	})

	it('runs longer than the target rather than flickering on a very dense plan', () => {
		expect(previewFrameIntervalMs(300)).toBe(16)
	})
})
