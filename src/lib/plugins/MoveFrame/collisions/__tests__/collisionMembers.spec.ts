import { createWorld, type Entity } from 'koota'
import { Matrix4 } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { relations, traits } from '$lib/ecs'

import { previewName } from '../../previewNames'
import { GhostOf } from '../../relations'
import { PreviewGhost } from '../../traits'
import { armBitFor, collectMembers, isGhost } from '../collisionMembers'
import { ENVIRONMENT_BIT } from '../interactionGroups'

let world: ReturnType<typeof createWorld>

const armBits = new Map([
	['arm', 1],
	['otherArm', 2],
])

/** A named frame, optionally parented to another. */
const spawnFrame = (name: string, parent?: Entity) =>
	world.spawn(
		traits.Name(name),
		traits.WorldMatrix(new Matrix4()),
		...(parent ? [relations.ChildOf(parent)] : [])
	)

/** A collider hanging off `parent`, the shape `GetGeometries` produces. */
const spawnCollider = (parent: Entity, name: string) =>
	world.spawn(
		relations.ChildOf(parent),
		traits.Name(name),
		traits.Box({ x: 100, y: 100, z: 100 }),
		traits.WorldMatrix(new Matrix4())
	)

const bitOf = (entity: Entity, members: ReturnType<typeof collectMembers>) =>
	members.find((member) => member.entity === entity)?.bit

beforeEach(() => {
	world = createWorld()
})

describe('armBitFor', () => {
	it("takes an arm's own link colliders, which parent straight to the component", () => {
		const arm = spawnFrame('arm')
		const link = spawnCollider(arm, 'arm:link_2')

		expect(armBitFor(link, armBits)).toBe(1)
	})

	it('walks past an intermediate component, so a mounted gripper joins its arm', () => {
		const arm = spawnFrame('arm')
		const gripper = spawnFrame('gripper', arm)
		const finger = spawnCollider(gripper, 'gripper:finger')

		expect(armBitFor(finger, armBits)).toBe(1)
	})

	it('puts anything with no arm above it in the environment', () => {
		const table = spawnFrame('table')

		expect(armBitFor(spawnCollider(table, 'table:top'), armBits)).toBe(ENVIRONMENT_BIT)
	})

	it('keeps two arms on their own bits', () => {
		const other = spawnFrame('otherArm')

		expect(armBitFor(spawnCollider(other, 'otherArm:link_1'), armBits)).toBe(2)
	})
})

describe('isGhost', () => {
	it('distinguishes a ghost from the entity it mirrors', () => {
		const source = world.spawn(traits.Box({ x: 100, y: 100, z: 100 }))
		const ghost = world.spawn(GhostOf(source), traits.Box({ x: 100, y: 100, z: 100 }))

		expect(isGhost(ghost)).toBe(true)
		expect(isGhost(source)).toBe(false)
	})
})

describe('a preview twin', () => {
	it('reads as a ghost, so a pair it hits is a warning about a move', () => {
		const twin = world.spawn(traits.Name(previewName('arm:link')), PreviewGhost)

		expect(isGhost(twin)).toBe(true)
	})

	/**
	 * A twin sits under the live frame its plan hangs off, so the ordinary parent walk reaches the
	 * arm without the twin needing a `GhostOf` back-reference.
	 */
	it('takes its arm bit from the live frame the chain hangs off', () => {
		const arm = spawnFrame('arm')
		const anchor = spawnFrame('arm:base', arm)
		const twin = world.spawn(
			relations.ChildOf(anchor),
			traits.Name(previewName('arm:link')),
			PreviewGhost,
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4())
		)

		expect(bitOf(twin, collectMembers(world, armBits))).toBe(1)
	})
})

describe('collectMembers', () => {
	it('collects every collidable primitive', () => {
		const table = spawnFrame('table')
		world.spawn(
			relations.ChildOf(table),
			traits.Sphere({ r: 50 }),
			traits.WorldMatrix(new Matrix4())
		)
		world.spawn(
			relations.ChildOf(table),
			traits.Capsule({ l: 300, r: 50 }),
			traits.WorldMatrix(new Matrix4())
		)
		spawnCollider(table, 'table:top')

		expect(collectMembers(world, armBits)).toHaveLength(3)
	})

	it('leaves out hidden geometry, which the user has said not to consider', () => {
		const table = spawnFrame('table')
		const hidden = spawnCollider(table, 'table:top')
		hidden.add(traits.InheritedInvisible)

		expect(collectMembers(world, armBits)).toHaveLength(0)
	})

	it('keeps a collider whose CAD model is drawn in its place', () => {
		const arm = spawnFrame('arm')
		const link = spawnCollider(arm, 'arm:link_2')
		link.add(traits.ColliderHidden)

		expect(bitOf(link, collectMembers(world, armBits))).toBe(1)
	})

	it("gives a ghost its source's bit, so a previewed gripper still ignores its arm", () => {
		const arm = spawnFrame('arm')
		const gripper = spawnFrame('gripper', arm)
		const finger = spawnCollider(gripper, 'gripper:finger')

		const ghost = world.spawn(
			GhostOf(finger),
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4())
		)

		expect(bitOf(ghost, collectMembers(world, armBits))).toBe(1)
	})

	it('falls back to the environment for a ghost whose source is gone', () => {
		const source = spawnCollider(spawnFrame('arm'), 'arm:link_2')
		const ghost = world.spawn(
			GhostOf(source),
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4())
		)
		source.destroy()

		expect(bitOf(ghost, collectMembers(world, armBits))).toBe(ENVIRONMENT_BIT)
	})
})
