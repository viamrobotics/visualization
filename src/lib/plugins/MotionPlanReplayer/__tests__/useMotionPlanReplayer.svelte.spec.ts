import { render } from '@testing-library/svelte'
import { type Entity, type World } from 'koota'
import { flushSync } from 'svelte'
import { UuidTool } from 'uuid-tool'
import { afterEach, describe, expect, it } from 'vitest'

import { Geometry, PoseInFrame, Sphere, Transform } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { traits } from '$lib/ecs'

import type { MotionPlanReplayerContext } from '../useMotionPlanReplayer.svelte'

import gantryPlan from './__fixtures__/gantry-plan.json?raw'
import ReplayerHarness from './__fixtures__/ReplayerHarness.svelte'

interface Mounted {
	ctx: MotionPlanReplayerContext
	world: World
}

const mounted: Mounted[] = []

const mount = (): Mounted => {
	let current: Mounted | undefined
	render(ReplayerHarness, {
		onReady: (ctx: MotionPlanReplayerContext, world: World) => (current = { ctx, world }),
	})
	if (!current) throw new Error('ReplayerHarness never called onReady')
	mounted.push(current)
	return current
}

/**
 * Koota hands out 16 world ids and then throws `Too many worlds created`, and unmounting the
 * harness does not release one. Without this the spec dies at the seventeenth test.
 */
afterEach(() => {
	for (const { world } of mounted.splice(0)) world.destroy()
})

/**
 * Snapshots that name their own plan: cycling one fixture across every plan makes their geometry
 * byte-identical, so a test could only notice a wrong length, never a wrong plan.
 */
const planSnapshots = (plan: string, steps: number): Snapshot[] =>
	Array.from(
		{ length: steps },
		() =>
			new Snapshot({
				transforms: [
					new Transform({
						referenceFrame: `${plan}-frame`,
						poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world' }),
						// Stable across a plan's steps, distinct across plans: reconcile keys on this, so
						// repeating it is what makes a scrub update the entity rather than respawn it.
						uuid: Uint8Array.from(UuidTool.toBytes(`${plan}-0000-4000-8000-000000000000`)),
					}),
				],
			})
	)

const addPlans = (ctx: MotionPlanReplayerContext, lengths: number[]) => {
	for (const [i, length] of lengths.entries()) {
		ctx.addPlan(`plan-${i}`, `content-${i}`, planSnapshots(`plan-${i}`, length))
	}
}

/**
 * Which plan's geometry is in the world now. The `-frame` suffix separates the drawn transforms
 * from the plan's own root entity, which is named for the plan.
 */
const drawnFrames = (world: World): string[] =>
	world
		.query(traits.Name)
		.map((entity: Entity) => entity.get(traits.Name))
		.filter((name): name is string => typeof name === 'string' && name.endsWith('-frame'))
		.toSorted()

const drawnEntity = (world: World): Entity =>
	world.query(traits.Name).find((entity) => entity.get(traits.Name)?.endsWith('-frame'))!

describe('removing a plan', () => {
	it('leaves the active plan reading its own snapshots, not its neighbour’s', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [2, 2, 6])

		expect(ctx.activePlanIndex).toBe(2)
		expect(ctx.totalSteps).toBe(6)

		ctx.removePlan(0)

		expect(ctx.activePlanIndex).toBe(1)
		expect(ctx.totalSteps).toBe(6)
		expect(drawnFrames(world)).toEqual(['plan-2-frame'])

		ctx.setStep(5)
		expect(ctx.currentStep).toBe(5)
		expect(drawnFrames(world)).toEqual(['plan-2-frame'])
	})

	it('lets a plan that shifted down still be reselected', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [2, 6, 3])

		ctx.removePlan(0)
		ctx.selectPlan(0)

		expect(ctx.plans[0]!.name).toBe('plan-1')
		expect(ctx.totalSteps).toBe(6)
		expect(drawnFrames(world)).toEqual(['plan-1-frame'])
		ctx.setStep(5)
		expect(ctx.currentStep).toBe(5)
	})

	// `addPlan` computes `index = plans.length`, which after a removal is a position another plan
	// still holds.
	it('does not overwrite a surviving plan when a new one is added after a removal', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [2, 3, 7])

		ctx.removePlan(0)
		ctx.addPlan('plan-3', 'content-3', planSnapshots('plan-3', 4))

		ctx.selectPlan(1)

		expect(ctx.plans[1]!.name).toBe('plan-2')
		expect(ctx.totalSteps).toBe(7)
		expect(drawnFrames(world)).toEqual(['plan-2-frame'])
		ctx.setStep(6)
		expect(ctx.currentStep).toBe(6)
	})

	it('clears the scene when the removed plan is the active one', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [2, 4])

		ctx.removePlan(1)

		expect(ctx.activePlanIndex).toBeNull()
		expect(ctx.totalSteps).toBe(0)
		expect(ctx.plans.map((p) => p.name)).toEqual(['plan-0'])
		expect(drawnFrames(world)).toEqual([])
	})

	it('holds the index still when the removed plan sits after the active one', () => {
		const { ctx } = mount()
		addPlans(ctx, [2, 4])
		ctx.selectPlan(0)

		ctx.removePlan(1)

		expect(ctx.activePlanIndex).toBe(0)
		expect(ctx.totalSteps).toBe(2)
	})

	it.each([
		['out of range', 7],
		['negative', -1],
		['fractional', 1.5],
	])('ignores a(n) %s index', (_label, index) => {
		const { ctx } = mount()
		addPlans(ctx, [2, 4, 6])
		expect(ctx.activePlanIndex).toBe(2)

		ctx.removePlan(index)

		expect(ctx.plans.map((p) => p.name)).toEqual(['plan-0', 'plan-1', 'plan-2'])
		expect(ctx.activePlanIndex).toBe(2)
		expect(ctx.totalSteps).toBe(6)
	})
})

describe('plan identity', () => {
	it('gives two plans with the same name distinct ids', () => {
		const { ctx } = mount()
		ctx.addPlan('same.json', 'content-a', planSnapshots('plan-a', 2))
		ctx.addPlan('same.json', 'content-b', planSnapshots('plan-b', 5))

		const [first, second] = ctx.plans
		expect(first!.id).not.toBe(second!.id)

		ctx.selectPlan(0)
		expect(ctx.totalSteps).toBe(2)
		ctx.selectPlan(1)
		expect(ctx.totalSteps).toBe(5)
	})

	it('keys a plan it parsed itself the same way, without landing on a live plan', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [2, 3])
		ctx.removePlan(0)
		ctx.addPlan('gantry.json', gantryPlan)

		expect(ctx.plans.map((p) => p.name)).toEqual(['plan-1', 'gantry.json'])
		expect(ctx.plans[1]!.status).toBe('ready')
		expect(ctx.totalSteps).toBe(2)

		ctx.selectPlan(0)

		expect(ctx.totalSteps).toBe(3)
		expect(drawnFrames(world)).toEqual(['plan-1-frame'])
	})
})

describe('scrubbing', () => {
	it.each([
		['below the first step', -3, 0],
		['past the last step', 99, 5],
	])('clamps a seek %s', (_label, requested, expected) => {
		const { ctx } = mount()
		addPlans(ctx, [6])

		ctx.setStep(requested)

		expect(ctx.currentStep).toBe(expected)
	})

	it('rewinds when the active plan is cleared', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [6])
		ctx.setStep(3)

		ctx.clearActivePlan()

		expect(ctx.currentStep).toBe(0)
		expect(ctx.activePlanIndex).toBeNull()
		expect(drawnFrames(world)).toEqual([])
	})

	it('keeps display edits made while scrubbing', () => {
		const { ctx, world } = mount()
		addPlans(ctx, [4])

		const entity = drawnEntity(world)
		entity.set(traits.Opacity, 0.25)
		entity.add(traits.Invisible)
		entity.add(traits.ShowAxesHelper)

		ctx.setStep(1)
		ctx.setStep(2)

		expect(entity.isAlive()).toBe(true)
		expect(entity.get(traits.Opacity)).toBeCloseTo(0.25)
		expect(entity.has(traits.Invisible)).toBe(true)
		expect(entity.has(traits.ShowAxesHelper)).toBe(true)
	})
})

describe('display defaults', () => {
	// `applyStep` colors only entities that got real geometry.
	it('colors a freshly spawned plan entity even though Color is always absent on spawn', () => {
		const { ctx, world } = mount()
		ctx.addPlan('plan-0', 'content-0', [
			new Snapshot({
				transforms: [
					new Transform({
						referenceFrame: 'plan-0-frame',
						poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world' }),
						physicalObject: new Geometry({
							geometryType: { case: 'sphere', value: new Sphere({ radiusMm: 10 }) },
						}),
						uuid: Uint8Array.from(UuidTool.toBytes('plan-0-0000-4000-8000-000000000000')),
					}),
				],
			}),
		])

		const entity = drawnEntity(world)

		expect(entity.has(traits.Color)).toBe(true)
		expect(entity.get(traits.Color)).toEqual({ r: 0, g: 0.47, b: 1 })
	})
})

describe('playback', () => {
	it('stops playback when a caller scrubs by hand', () => {
		const { ctx } = mount()
		addPlans(ctx, [6])
		ctx.player.play()
		flushSync()
		expect(ctx.player.isPlaying).toBe(true)

		ctx.setStep(3)

		expect(ctx.player.isPlaying).toBe(false)
		expect(ctx.currentStep).toBe(3)
	})

	it.each([
		['reselected', (ctx: MotionPlanReplayerContext) => ctx.selectPlan(0)],
		['removed', (ctx: MotionPlanReplayerContext) => ctx.removePlan(0)],
	])('rewinds to the first frame when the active plan is %s', (_label, act) => {
		const { ctx } = mount()
		addPlans(ctx, [6])
		ctx.setStep(4)
		expect(ctx.currentStep).toBe(4)

		act(ctx)

		expect(ctx.currentStep).toBe(0)
	})

	// A short or gappy snapshot array is what a partial response from the host's
	// `resolvePlanSnapshots` looks like from here, and `stepCount` is taken from its length either way.
	it('holds the index on a step with no snapshot behind it', () => {
		const { ctx } = mount()
		const [first, , third] = planSnapshots('gappy', 3)
		ctx.addPlan('gappy', 'content', [first!, undefined as unknown as Snapshot, third!])

		expect(ctx.totalSteps).toBe(3)

		ctx.setStep(1)
		expect(ctx.currentStep).toBe(0)

		ctx.setStep(2)
		expect(ctx.currentStep).toBe(2)
	})
})
