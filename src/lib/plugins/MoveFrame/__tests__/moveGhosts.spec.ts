import { createWorld, type Entity, type World } from 'koota'
import { BoxGeometry, Matrix4, Vector3 } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { relations, traits } from '$lib/ecs'

import { clearMoveGhosts, createMoveGhosts, rigidMoveDelta, syncMoveGhosts } from '../moveGhosts'

/** A metre along +x — enough to tell a ghost's transform from its source's. */
const delta = new Matrix4().makeTranslation(1, 0, 0)

const position = (entity: Entity) =>
	new Vector3().setFromMatrixPosition(entity.get(traits.WorldMatrix) ?? new Matrix4())

describe('rigidMoveDelta', () => {
	it('is the motion that carries the current pose onto the staged one', () => {
		const current = new Matrix4().makeTranslation(1, 2, 3)
		const target = new Matrix4().makeTranslation(4, 2, 3)

		const moved = current.clone().premultiply(rigidMoveDelta(current, target))

		expect(moved.elements).toEqual(target.elements)
	})

	it('reuses one matrix, so callers must consume it before the next call', () => {
		const first = rigidMoveDelta(new Matrix4(), new Matrix4().makeTranslation(1, 0, 0))
		const second = rigidMoveDelta(new Matrix4(), new Matrix4().makeTranslation(9, 0, 0))

		expect(first).toBe(second)
		expect(second.elements[12]).toBe(9)
	})
})

describe('syncMoveGhosts', () => {
	let world: World
	let root: Entity
	let ghosts: ReturnType<typeof createMoveGhosts>

	/** A child frame with a box, one metre along +y from wherever its parent is. */
	const spawnFrame = (parent: Entity, y: number, ...extra: Parameters<World['spawn']>) =>
		world.spawn(
			relations.ChildOf(parent),
			traits.FramesAPI,
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4().makeTranslation(0, y, 0)),
			...extra
		)

	/** Every ghost in the world, found the way the renderers find them. */
	const ghostEntities = () => [...world.query(traits.NonSelectable)]

	beforeEach(() => {
		world = createWorld()
		root = world.spawn(traits.FramesAPI, traits.WorldMatrix(new Matrix4()))
		ghosts = createMoveGhosts()
	})

	it('ghosts the dragged frame itself, so its own geometry previews', () => {
		root.add(traits.Box({ x: 100, y: 100, z: 100 }))

		syncMoveGhosts(world, root, delta, ghosts)

		expect(position(ghosts.get(root)!)).toEqual(new Vector3(1, 0, 0))
		expect(ghosts.get(root)?.get(traits.Box)).toEqual({ x: 100, y: 100, z: 100 })
	})

	// `MoveTargetGhost` already draws a triad on the staged pose, so a second one
	// would sit exactly on top of it.
	it('leaves a dragged frame with no geometry to MoveTargetGhost', () => {
		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghostEntities()).toHaveLength(0)
	})

	it('ghosts each descendant at its own transform plus the delta', () => {
		const child = spawnFrame(root, 1)
		const grandchild = spawnFrame(child, 2)

		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghostEntities()).toHaveLength(2)
		expect(position(ghosts.get(child)!)).toEqual(new Vector3(1, 1, 0))
		expect(position(ghosts.get(grandchild)!)).toEqual(new Vector3(1, 2, 0))
	})

	it('copies the geometry the renderers draw from', () => {
		const child = spawnFrame(root, 1, traits.Center({ x: 5, y: 0, z: 0, oX: 0, oY: 0, oZ: 1 }))

		syncMoveGhosts(world, root, delta, ghosts)

		const ghost = ghosts.get(child)!
		expect(ghost.get(traits.Box)).toEqual({ x: 100, y: 100, z: 100 })
		expect(ghost.get(traits.Center)?.x).toBe(5)
		expect(ghost.get(traits.Opacity)).toBe(0.5)
		expect(ghost.has(traits.NonSelectable)).toBe(true)
	})

	it('ghosts a frame with no geometry as an axes triad', () => {
		const child = world.spawn(
			relations.ChildOf(root),
			traits.FramesAPI,
			traits.WorldMatrix(new Matrix4())
		)

		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghosts.get(child)?.has(traits.ShowAxesHelper)).toBe(true)
	})

	// IK re-solves the dragged frame's own chain, and the entity sits at the
	// component's mount while the gizmo drags its end effector. Neither lands
	// where the drag delta would put it.
	it('leaves the dragged frame and its own kinematic links behind', () => {
		root.add(traits.Box({ x: 100, y: 100, z: 100 }))
		spawnFrame(root, 1, traits.KinematicLink)

		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghostEntities()).toHaveLength(0)
	})

	it('ghosts the links of an attached component, which do ride along', () => {
		const gripper = spawnFrame(root, 1)
		const link = spawnFrame(gripper, 1, traits.KinematicLink)

		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghosts.has(link)).toBe(true)
	})

	it('reuses ghosts across syncs and tracks the source as it moves', () => {
		const child = spawnFrame(root, 1)

		syncMoveGhosts(world, root, delta, ghosts)
		const ghost = ghosts.get(child)!

		child.get(traits.WorldMatrix)?.makeTranslation(0, 5, 0)
		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghosts.get(child)).toBe(ghost)
		expect(position(ghost)).toEqual(new Vector3(1, 5, 0))
	})

	it('follows a source whose dimensions change mid-drag', () => {
		const child = spawnFrame(root, 1)
		syncMoveGhosts(world, root, delta, ghosts)

		child.set(traits.Box, { x: 7, y: 7, z: 7 })
		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghosts.get(child)?.get(traits.Box)).toEqual({ x: 7, y: 7, z: 7 })
	})

	it('respawns the ghost when the source swaps shape', () => {
		const child = spawnFrame(root, 1)
		syncMoveGhosts(world, root, delta, ghosts)
		const ghost = ghosts.get(child)!

		child.remove(traits.Box)
		child.add(traits.Sphere({ r: 50 }))
		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghost.isAlive()).toBe(false)
		expect(ghosts.get(child)?.get(traits.Sphere)).toEqual({ r: 50 })
		expect(ghostEntities()).toHaveLength(1)
	})

	it('clones mesh geometry rather than sharing it', () => {
		const geometry = new BoxGeometry(1, 1, 1)
		const child = world.spawn(
			relations.ChildOf(root),
			traits.FramesAPI,
			traits.BufferGeometry(geometry),
			traits.WorldMatrix(new Matrix4())
		)

		syncMoveGhosts(world, root, delta, ghosts)

		// `Mesh.svelte` disposes the geometry it renders, so a shared instance
		// would die with the ghost.
		expect(ghosts.get(child)?.get(traits.BufferGeometry)).not.toBe(geometry)
	})

	/**
	 * The instanced renderers allocate on `onAdd` and rewrite matrices on
	 * `onChange` — a ghost that spawns without firing either would never be
	 * drawn.
	 */
	it('notifies the renderers when a ghost appears and when it moves', () => {
		const added: Entity[] = []
		const changed: Entity[] = []
		world.onAdd(traits.Box, (entity) => added.push(entity))
		world.onChange(traits.WorldMatrix, (entity) => changed.push(entity))

		const child = spawnFrame(root, 1)
		syncMoveGhosts(world, root, delta, ghosts)
		const ghost = ghosts.get(child)!

		expect(added).toContain(ghost)

		changed.length = 0
		syncMoveGhosts(world, root, new Matrix4().makeTranslation(2, 0, 0), ghosts)

		expect(changed).toContain(ghost)
	})

	it('drops the ghost of a source that goes away or turns invisible', () => {
		const removed = spawnFrame(root, 1)
		const hidden = spawnFrame(root, 2)
		syncMoveGhosts(world, root, delta, ghosts)
		expect(ghostEntities()).toHaveLength(2)

		removed.destroy()
		hidden.add(traits.InheritedInvisible)
		syncMoveGhosts(world, root, delta, ghosts)

		expect(ghostEntities()).toHaveLength(0)
		expect(ghosts.size).toBe(0)
	})

	it.each([
		['no delta', () => syncMoveGhosts(world, root, undefined, ghosts)],
		['no root', () => syncMoveGhosts(world, undefined, delta, ghosts)],
		['an explicit clear', () => clearMoveGhosts(ghosts)],
	])('clears every ghost on %s', (_label, act) => {
		spawnFrame(root, 1)
		syncMoveGhosts(world, root, delta, ghosts)
		expect(ghostEntities()).toHaveLength(1)

		act()

		expect(ghostEntities()).toHaveLength(0)
		expect(ghosts.size).toBe(0)
	})
})
