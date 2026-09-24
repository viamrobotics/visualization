import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RawKinematicsModel } from '../kinematicsTransform'

import { deriveKinematicsFrames, ownerOfInternalFrame } from '../kinematicsFrames'
import gantryPlan from '../plugins/MotionPlanReplayer/__tests__/__fixtures__/gantry-plan.json?raw'
import { parsePlan } from '../plugins/MotionPlanReplayer/parse-plan'

/**
 * The models here are lifted from a captured frame system rather than written by
 * hand, because the shape is the thing under test: `FrameSystemConfig.kinematics`
 * is rdk's `ModelConfigJSON`, the same object a plan capture stores under a model
 * frame. Hand-written input would let a wrong assumption about that shape pass.
 */
const modelFromCapture = (raw: string, componentName: string): RawKinematicsModel => {
	const frame = parsePlan(raw).frames[componentName]?.frame as
		| { model?: RawKinematicsModel }
		| undefined
	const model = frame?.model
	if (!model) throw new Error(`no model frame for "${componentName}" in capture`)
	return model
}

const parentByName = (frames: ReturnType<typeof deriveKinematicsFrames>) =>
	Object.fromEntries(
		frames.map((frame) => [frame.referenceFrame, frame.poseInObserverFrame?.referenceFrame])
	)

describe('deriveKinematicsFrames', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	afterEach(() => warn.mockClear())

	describe('a real xArm6', () => {
		const model = modelFromCapture(gantryPlan, 'arm-1')
		const frames = deriveKinematicsFrames('arm-1', model)
		const parents = parentByName(frames)

		it('reads the capture as a link/joint model', () => {
			expect(model.links).toHaveLength(7)
			expect(model.joints).toHaveLength(6)
			expect(model.kinematic_param_type).toBeUndefined()
		})

		it('roots the first link on the component frame', () => {
			expect(parents['arm-1:base']).toBe('arm-1')
		})

		/**
		 * rdk's own parent map threads each link through its joint
		 * (`arm-1:base_top` -> `arm-1:waist`). Only links become frames here, so the
		 * joints collapse — `getPose` is asked for the link against this same
		 * parent, so the rotation still arrives, just without a frame to name it.
		 */
		it('collapses joints so a link hangs off its nearest link ancestor', () => {
			expect(parents).toMatchObject({
				'arm-1:base_top': 'arm-1:base',
				'arm-1:upper_arm': 'arm-1:base_top',
				'arm-1:upper_forearm': 'arm-1:upper_arm',
				'arm-1:lower_forearm': 'arm-1:upper_forearm',
				'arm-1:wrist_link': 'arm-1:lower_forearm',
				'arm-1:gripper_mount': 'arm-1:wrist_link',
			})
		})

		/** The editing layer addresses frames by name, and only config frames have a component behind them. */
		it('emits no frame for the component itself', () => {
			expect(parents['arm-1']).toBeUndefined()
			expect(parents['arm-1_origin']).toBeUndefined()
		})

		it('emits one frame per link', () => {
			expect(frames).toHaveLength(7)
			expect(warn).not.toHaveBeenCalled()
		})

		/** Every geometry in this capture omits `type`, so inference is load-bearing. */
		it('infers geometry shapes the captured model leaves untyped', () => {
			const byName = Object.fromEntries(frames.map((f) => [f.referenceFrame, f]))

			expect(byName['arm-1:base']?.physicalObject?.geometryType.case).toBe('sphere')
			expect(byName['arm-1:base_top']?.physicalObject?.geometryType.case).toBe('capsule')
			expect(byName['arm-1:upper_forearm']?.physicalObject?.geometryType.case).toBe('box')
		})

		/**
		 * The case the parent-relative convention exists for. `upper_arm` sits at
		 * (53.5, 0, 284.5) from its joint and authors its capsule at (0, 40, 135) —
		 * and that offset is measured from the *joint*, not from the link, so the
		 * link's own translation comes back out. Passing the authored numbers
		 * through unchanged would push every collision volume one link too far.
		 */
		it.each([
			['arm-1:upper_arm', [-53.5, 40, -149.5]],
			['arm-1:lower_forearm', [0, -27.5, 65.2]],
		] satisfies [string, number[]][])(
			'places %s geometry in link-local coordinates',
			(name, [x, y, z]) => {
				const center = frames.find((f) => f.referenceFrame === name)?.physicalObject?.center

				expect(center?.x).toBeCloseTo(x!, 3)
				expect(center?.y).toBeCloseTo(y!, 3)
				expect(center?.z).toBeCloseTo(z!, 3)
			}
		)
	})

	describe('a real one-joint gantry', () => {
		const frames = deriveKinematicsFrames('gantry-1', modelFromCapture(gantryPlan, 'gantry-1'))
		const parents = parentByName(frames)

		it('mirrors the capture, joints collapsed', () => {
			expect(parents).toEqual({
				'gantry-1:base': 'gantry-1',
				'gantry-1:carriage': 'gantry-1:base',
			})
		})
	})

	describe('models it cannot resolve', () => {
		it('emits nothing for a DH model, and says so', () => {
			const frames = deriveKinematicsFrames('arm-2', {
				kinematic_param_type: 'DH',
				dhParams: [{}, {}],
			})

			expect(frames).toHaveLength(0)
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('DH-parameter model'))
		})

		/** A forked model still positions its children off the component frame. */
		it('handles a model with more than one leaf', () => {
			const frames = deriveKinematicsFrames('arm-3', {
				links: [
					{ id: 'base', parent: 'world' },
					{ id: 'left', parent: 'base' },
					{ id: 'right', parent: 'base' },
				],
			})

			expect(parentByName(frames)).toEqual({
				'arm-3:base': 'arm-3',
				'arm-3:left': 'arm-3:base',
				'arm-3:right': 'arm-3:base',
			})
		})

		it('roots a link whose parent is missing from the model on the component', () => {
			const frames = deriveKinematicsFrames('arm-4', {
				links: [{ id: 'only', parent: 'a_joint_that_does_not_exist' }],
			})

			expect(parentByName(frames)['arm-4:only']).toBe('arm-4')
		})

		/** A cycle would otherwise walk forever looking for a link ancestor. */
		it('survives a parent chain that loops', () => {
			const frames = deriveKinematicsFrames('arm-5', {
				links: [{ id: 'link', parent: 'j1' }],
				joints: [
					{ id: 'j1', parent: 'j2' },
					{ id: 'j2', parent: 'j1' },
				],
			})

			expect(parentByName(frames)['arm-5:link']).toBe('arm-5')
		})

		it('emits nothing for a model with no links', () => {
			expect(deriveKinematicsFrames('gripper-1', {})).toHaveLength(0)
		})
	})

	/** Two arms of the same model share link ids, so the namespace has to scope them. */
	it('scopes link ids to the owning component', () => {
		const model: RawKinematicsModel = { links: [{ id: 'base' }] }
		const left = deriveKinematicsFrames('left-arm', model).map((f) => f.referenceFrame)
		const right = deriveKinematicsFrames('right-arm', model).map((f) => f.referenceFrame)

		expect(left).toContain('left-arm:base')
		expect(right).toContain('right-arm:base')
		expect(left).not.toContain('right-arm:base')
	})
})

describe('ownerOfInternalFrame', () => {
	it('reads the component off a namespaced frame', () => {
		expect(ownerOfInternalFrame('arm-1:upper_arm')).toBe('arm-1')
	})

	it('returns undefined for a frame that is not namespaced', () => {
		expect(ownerOfInternalFrame('arm-1_origin')).toBeUndefined()
		expect(ownerOfInternalFrame('world')).toBeUndefined()
	})
})
