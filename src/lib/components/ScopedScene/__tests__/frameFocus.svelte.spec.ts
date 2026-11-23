import type { Entity, World } from 'koota'

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

import { PreviewGhost } from '#lib/components/motion/previewGhostTrait.js'
import { hierarchy, relations, resolveOpacity, traits } from '#lib/ecs/index.js'

import FrameFocusHost from './__fixtures__/FrameFocusHost.svelte'

const POINT_CLOUD_OPACITY = 0.8
const DRAW_BOX_OPACITY = 0.9
const USER_OPACITY = 0.7

const mount = (frame: string | undefined) => {
	let world: World | undefined
	const result = render(FrameFocusHost, {
		frame,
		onready: (ready: World) => {
			world = ready
		},
	})
	if (!world) throw new Error('FrameFocusHost never handed out its world')
	return { ...result, world }
}

/** Lets the hook's coalesced re-run land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const byName = (world: World, name: string): Entity => {
	const entity = world.query(traits.Name).find((candidate) => candidate.get(traits.Name) === name)
	if (!entity) throw new Error(`no entity named ${name}`)
	return entity
}

const dimmedNames = (world: World): string[] =>
	world
		.query(traits.Dimmed)
		.map((entity) => entity.get(traits.Name) ?? '')
		.toSorted()

const spawnArm = (world: World, name: string, parent?: Entity) => {
	const arm = parent
		? world.spawn(traits.Name(name), relations.ChildOf(parent))
		: world.spawn(traits.Name(name))
	const base = world.spawn(traits.Name(`${name}:base`), traits.Box, relations.ChildOf(arm))
	const upper = world.spawn(traits.Name(`${name}:upper`), traits.Capsule, relations.ChildOf(base))
	return { arm, base, upper }
}

/** Two arms, the first on a table with a gripper on its last link, plus an obstacle, a point cloud, and a draw API box. */
const spawnScene = (world: World) => {
	const table = world.spawn(traits.Name('table'), traits.Box)
	const arm1 = spawnArm(world, 'arm-1', table)
	world.spawn(traits.Name('gripper'), traits.Sphere, relations.ChildOf(arm1.upper))
	spawnArm(world, 'arm-2')
	world.spawn(traits.Name('obstacle'), traits.Box)
	world.spawn(
		traits.Name('point-cloud'),
		traits.Points,
		traits.BufferGeometry,
		traits.Opacity(POINT_CLOUD_OPACITY)
	)
	world.spawn(traits.Name('draw-box'), traits.DrawAPI, traits.Box, traits.Opacity(DRAW_BOX_OPACITY))
}

const ARM_1_FOCUS_DIMS = ['arm-2:base', 'arm-2:upper', 'obstacle']
const ARM_2_FOCUS_DIMS = ['arm-1:base', 'arm-1:upper', 'gripper', 'obstacle', 'table']
const EVERY_CANDIDATE = [
	'arm-1:base',
	'arm-1:upper',
	'arm-2:base',
	'arm-2:upper',
	'gripper',
	'obstacle',
	'table',
]

describe('useFrameFocus', () => {
	it('dims every collidable geometry outside the focused arm, its subtree, and its ancestors', async () => {
		const { world } = mount('arm-1')
		spawnScene(world)
		await settle()

		expect(dimmedNames(world)).toEqual(ARM_1_FOCUS_DIMS)
		expect(ARM_1_FOCUS_DIMS.map((name) => resolveOpacity(byName(world, name)))).toEqual([
			0.5, 0.5, 0.5,
		])
		expect(resolveOpacity(byName(world, 'point-cloud'))).toBe(POINT_CLOUD_OPACITY)
		expect(resolveOpacity(byName(world, 'draw-box'))).toBe(DRAW_BOX_OPACITY)
	})

	it('swaps focus when the frame changes', async () => {
		const { world, rerender } = mount('arm-1')
		spawnScene(world)
		await settle()

		await rerender({ frame: 'arm-2' })

		expect(dimmedNames(world)).toEqual(ARM_2_FOCUS_DIMS)
	})

	it('dims nothing once the frame is cleared', async () => {
		const { world, rerender } = mount('arm-1')
		spawnScene(world)
		await settle()

		await rerender({ frame: undefined })

		expect(dimmedNames(world)).toEqual([])
	})

	it('dims nothing for an empty name', async () => {
		const { world } = mount('')
		spawnScene(world)
		await settle()

		expect(dimmedNames(world)).toEqual([])
	})

	it('focuses `<name>_origin` like the bare component name', async () => {
		const { world } = mount('arm-1_origin')
		spawnScene(world)
		await settle()

		expect(dimmedNames(world)).toEqual(ARM_1_FOCUS_DIMS)
	})

	it('dims every candidate for a name that matches nothing', async () => {
		const { world } = mount('no-such-frame')
		spawnScene(world)
		await settle()

		expect(dimmedNames(world)).toEqual(EVERY_CANDIDATE)
	})

	it('dims an arm that spawns after the focus is set', async () => {
		const { world } = mount('arm-1')
		const table = world.spawn(traits.Name('table'), traits.Box)
		spawnArm(world, 'arm-1', table)
		await settle()
		expect(dimmedNames(world)).toEqual([])

		spawnArm(world, 'arm-2')
		await settle()

		expect(dimmedNames(world)).toEqual(['arm-2:base', 'arm-2:upper'])
	})

	it('focuses correctly when the focus is set before any entity exists', async () => {
		const { world } = mount('arm-1')
		await settle()
		expect(dimmedNames(world)).toEqual([])

		spawnScene(world)
		await settle()

		expect(dimmedNames(world)).toEqual(ARM_1_FOCUS_DIMS)
	})

	it('leaves nothing dimmed by the old focus when the frame changes mid-load', async () => {
		const { world, rerender } = mount('arm-1')
		const arm1 = world.spawn(traits.Name('arm-1'), traits.Orphan('table'))
		world.spawn(traits.Name('arm-1:base'), traits.Box, relations.ChildOf(arm1))
		const arm2Base = world.spawn(traits.Name('arm-2:base'), traits.Box, traits.Orphan('arm-2'))
		await settle()
		expect(dimmedNames(world)).toEqual(['arm-2:base'])

		await rerender({ frame: 'arm-2' })
		world.spawn(traits.Name('table'), traits.Box)
		const arm2 = world.spawn(traits.Name('arm-2'))
		await settle()
		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))
		await settle()

		expect(arm2Base.targetFor(relations.ChildOf)).toBe(arm2)
		expect(arm1.targetFor(relations.ChildOf)).toBe(byName(world, 'table'))
		expect(dimmedNames(world)).toEqual(['arm-1:base', 'table'])
	})

	it('removes every Dimmed on unmount, including from a burst still pending', async () => {
		const { world, unmount } = mount('arm-1')
		spawnScene(world)
		await settle()
		expect(dimmedNames(world)).not.toEqual([])

		world.spawn(traits.Name('late-obstacle'), traits.Box)
		unmount()
		await settle()

		expect(world.query(traits.Dimmed)).toHaveLength(0)
	})

	it('leaves a preview ghost outside the focus undimmed', async () => {
		const { world } = mount('arm-1')
		spawnScene(world)
		const arm2 = byName(world, 'arm-2')
		const ghost = world.spawn(
			traits.Name('preview:arm-2:upper'),
			traits.Box,
			PreviewGhost,
			relations.ChildOf(arm2)
		)
		await settle()

		expect(dimmedNames(world)).toEqual(ARM_1_FOCUS_DIMS)
		expect(ghost.has(traits.Dimmed)).toBe(false)
	})

	it('leaves a user OpacityOverride intact after focusing its entity out and back in', async () => {
		const { world, rerender } = mount('arm-1')
		spawnScene(world)
		const obstacle = byName(world, 'obstacle')
		obstacle.add(traits.OpacityOverride(USER_OPACITY))
		await settle()
		expect(resolveOpacity(obstacle)).toBe(0.35)

		await rerender({ frame: 'obstacle' })

		expect(obstacle.has(traits.Dimmed)).toBe(false)
		expect(obstacle.get(traits.OpacityOverride)).toBe(USER_OPACITY)
		expect(resolveOpacity(obstacle)).toBe(USER_OPACITY)
	})
})
