import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))

import type { Frame } from '$lib/frame'

import { hierarchy, traits } from '$lib/ecs'
import { installWorldMatrixListeners } from '$lib/ecs/worldMatrix'
import { Pose } from '$lib/math'

import { applyFrameHistorySnapshotToWorld } from '../frameHistory'

describe('frame history replay', () => {
	let world: World

	afterEach(() => {
		world?.destroy()
	})

	it('writes dirty snapshots into EditedMatrix and frame traits', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Matrix(),
			traits.LiveMatrix(new Pose(10, 0, 0).toMatrix4()),
			traits.Box({ x: 1, y: 2, z: 3 })
		)

		applyFrameHistorySnapshotToWorld(
			world,
			{
				components: [
					{
						name: 'arm',
						frame: {
							parent: 'base',
							translation: { x: 100, y: 0, z: 0 },
							orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
							geometry: { type: 'sphere', r: 42 },
						},
					},
				],
			},
			{},
			{ mode: 'edit' }
		)

		const edited = entity.get(traits.EditedMatrix)
		expect(edited).toBeDefined()
		expect(new Pose().setFromMatrix4(edited!).x).toBe(100)
		expect(hierarchy.getParentName(entity)).toBe('base')
		expect(entity.has(traits.Box)).toBe(false)
		expect(entity.get(traits.Sphere)).toStrictEqual({ r: 42 })
	})

	it('removes EditedMatrix and updates baseline matrices for clean snapshots', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Matrix(),
			traits.LiveMatrix(new Pose(10, 0, 0).toMatrix4()),
			traits.EditedMatrix(new Pose(20, 0, 0).toMatrix4()),
			traits.Sphere({ r: 5 })
		)

		applyFrameHistorySnapshotToWorld(
			world,
			{
				components: [
					{
						name: 'arm',
						frame: {
							parent: 'world',
							translation: { x: 300, y: 0, z: 0 },
							orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
						},
					},
				],
			},
			{},
			{ mode: 'save' }
		)

		expect(entity.has(traits.EditedMatrix)).toBe(false)
		expect(new Pose().setFromMatrix4(entity.get(traits.Matrix)!).x).toBe(300)
		expect(new Pose().setFromMatrix4(entity.get(traits.LiveMatrix)!).x).toBe(30)
		expect(hierarchy.getParentName(entity)).toBeUndefined()
		expect(entity.has(traits.Sphere)).toBe(false)
	})

	it('preserves untouched live snapshots when saving', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Matrix(),
			traits.LiveMatrix(new Pose(125, 0, 0).toMatrix4())
		)

		applyFrameHistorySnapshotToWorld(
			world,
			{
				components: [
					{
						name: 'arm',
						frame: {
							parent: 'world',
							translation: { x: 0, y: 0, z: 0 },
							orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
						},
					},
				],
			},
			{},
			{ mode: 'save' }
		)

		expect(new Pose().setFromMatrix4(entity.get(traits.Matrix)!).x).toBe(0)
		expect(new Pose().setFromMatrix4(entity.get(traits.LiveMatrix)!).x).toBe(125)
	})

	it('preserves live snapshots and removes edits when discarding', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Matrix(),
			traits.LiveMatrix(new Pose(125, 0, 0).toMatrix4()),
			traits.EditedMatrix(new Pose(500, 0, 0).toMatrix4())
		)

		applyFrameHistorySnapshotToWorld(
			world,
			{
				components: [
					{
						name: 'arm',
						frame: {
							parent: 'world',
							translation: { x: 40, y: 0, z: 0 },
							orientation: { type: 'ov_degrees' } as Frame['orientation'],
						},
					},
				],
			},
			{},
			{ mode: 'discard' }
		)

		expect(entity.has(traits.EditedMatrix)).toBe(false)
		expect(new Pose().setFromMatrix4(entity.get(traits.Matrix)!).x).toBe(40)
		expect(new Pose().setFromMatrix4(entity.get(traits.LiveMatrix)!).x).toBe(125)
	})

	it('holds the edited pose after the baseline is re-derived from the saved config', async () => {
		world = createWorld()
		const unsub = installWorldMatrixListeners(world)

		// useFrames spawns the frame at its saved pose, then the user drags it.
		const entity = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Matrix(new Pose(100).toMatrix4()),
			traits.LiveMatrix(new Pose(100).toMatrix4()),
			traits.EditedMatrix(new Pose(500).toMatrix4())
		)
		await Promise.resolve()
		expect(entity.get(traits.WorldMatrix)?.elements[12]).toBeCloseTo(0.5)

		// Saving commits the config into the world.
		applyFrameHistorySnapshotToWorld(
			world,
			{
				components: [
					{
						name: 'arm',
						frame: {
							parent: 'world',
							translation: { x: 500, y: 0, z: 0 },
							orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
						},
					},
				],
			},
			{},
			{ mode: 'save' }
		)

		// Back in monitor mode useFrames re-derives the baseline from the saved
		// config. Without the commit above, the blend would cancel the edit
		// against a LiveMatrix still holding the pre-save pose.
		new Pose(500).toMatrix4(entity.get(traits.Matrix)!)
		entity.changed(traits.Matrix)
		await Promise.resolve()

		expect(entity.get(traits.WorldMatrix)?.elements[12]).toBeCloseTo(0.5)
		unsub()
	})
})
