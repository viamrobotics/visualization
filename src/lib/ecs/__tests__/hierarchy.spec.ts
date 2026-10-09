import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { hierarchy, relations, traits } from '#lib/ecs/index.js'

describe('hierarchy.parentTraits', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('returns an empty list for undefined, empty, or world parents', () => {
		expect(hierarchy.parentTraits(undefined)).toEqual([])
		expect(hierarchy.parentTraits('')).toEqual([])
		expect(hierarchy.parentTraits('world')).toEqual([])
	})

	it('spawns without Orphan/ChildOf when parent is world-like', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('child'), ...hierarchy.parentTraits('world'))
		expect(entity.has(traits.Orphan)).toBe(false)
		expect(entity.targetFor(relations.ChildOf)).toBeUndefined()
	})

	it('emits Orphan(name) for a named parent — resolver swaps it later', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('child'), ...hierarchy.parentTraits('arm'))
		expect(entity.get(traits.Orphan)).toBe('arm')
		expect(entity.targetFor(relations.ChildOf)).toBeUndefined()
	})
})

describe('hierarchy.setParent', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('is a no-op state when parent is undefined and entity had no parent', () => {
		world = createWorld()
		const entity = world.spawn()

		hierarchy.setParent(entity, undefined)

		expect(entity.has(traits.Orphan)).toBe(false)
		expect(entity.targetFor(relations.ChildOf)).toBeUndefined()
	})

	it("strips the parent relation when name is 'world'", () => {
		world = createWorld()
		const entity = world.spawn(traits.Orphan('arm'))

		hierarchy.setParent(entity, 'world')

		expect(entity.has(traits.Orphan)).toBe(false)
		expect(entity.targetFor(relations.ChildOf)).toBeUndefined()
	})

	it('writes Orphan(name) when transitioning from unset to a named parent', () => {
		world = createWorld()
		const entity = world.spawn()

		hierarchy.setParent(entity, 'arm')

		expect(entity.get(traits.Orphan)).toBe('arm')
	})

	it('replaces an existing Orphan when switching named parents', () => {
		world = createWorld()
		const entity = world.spawn(traits.Orphan('arm'))

		hierarchy.setParent(entity, 'base')

		expect(entity.get(traits.Orphan)).toBe('base')
	})

	it('replaces an existing ChildOf when switching named parents', () => {
		world = createWorld()
		const arm = world.spawn(traits.Name('arm'))
		const child = world.spawn(relations.ChildOf(arm))

		hierarchy.setParent(child, 'base')

		expect(child.targetFor(relations.ChildOf)).toBeUndefined()
		expect(child.get(traits.Orphan)).toBe('base')
	})

	it('survives an arm -> world -> base round-trip', () => {
		world = createWorld()
		const entity = world.spawn()

		hierarchy.setParent(entity, 'arm')
		expect(entity.get(traits.Orphan)).toBe('arm')

		hierarchy.setParent(entity, 'world')
		expect(entity.has(traits.Orphan)).toBe(false)

		hierarchy.setParent(entity, 'base')
		expect(entity.get(traits.Orphan)).toBe('base')
	})
})

describe('hierarchy.resolveOrphans', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('converts Orphan to ChildOf once a parent with that name appears', () => {
		world = createWorld()
		const child = world.spawn(traits.Name('child'), traits.Orphan('arm'))
		expect(child.targetFor(relations.ChildOf)).toBeUndefined()

		const arm = world.spawn(traits.Name('arm'))

		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))

		expect(child.has(traits.Orphan)).toBe(false)
		expect(child.targetFor(relations.ChildOf)).toBe(arm)
	})

	it('leaves orphans untouched when no matching parent exists', () => {
		world = createWorld()
		const child = world.spawn(traits.Name('child'), traits.Orphan('missing'))

		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))

		expect(child.get(traits.Orphan)).toBe('missing')
		expect(child.targetFor(relations.ChildOf)).toBeUndefined()
	})

	it('is idempotent — second call with no new parents is a no-op', () => {
		world = createWorld()
		const child = world.spawn(traits.Orphan('missing'))

		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))
		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))

		expect(child.get(traits.Orphan)).toBe('missing')
	})

	it('resolves multiple orphans with the same parent in a single pass', () => {
		world = createWorld()
		const a = world.spawn(traits.Orphan('arm'))
		const b = world.spawn(traits.Orphan('arm'))
		const arm = world.spawn(traits.Name('arm'))

		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))

		expect(a.targetFor(relations.ChildOf)).toBe(arm)
		expect(b.targetFor(relations.ChildOf)).toBe(arm)
	})

	it('does not parent an entity to itself when Name and Orphan are the same', () => {
		world = createWorld()
		const geometry = world.spawn(traits.Name('arm'), traits.Orphan('arm'))

		hierarchy.resolveOrphans(world.query(traits.Name), world.query(traits.Orphan))

		expect(geometry.get(traits.Orphan)).toBe('arm') // still unresolved
		expect(geometry.targetFor(relations.ChildOf)).toBeUndefined()
	})
})

describe('hierarchy.getParentName', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('returns undefined for a world-root entity', () => {
		world = createWorld()
		const entity = world.spawn()
		expect(hierarchy.getParentName(entity)).toBeUndefined()
	})

	it('reads through ChildOf to the parent name', () => {
		world = createWorld()
		const arm = world.spawn(traits.Name('arm'))
		const child = world.spawn(relations.ChildOf(arm))
		expect(hierarchy.getParentName(child)).toBe('arm')
	})

	it('falls back to Orphan when the parent is unresolved', () => {
		world = createWorld()
		const child = world.spawn(traits.Orphan('missing'))
		expect(hierarchy.getParentName(child)).toBe('missing')
	})
})

describe('hierarchy.destroyEntityTree', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('destroys a root and every ChildOf descendant', () => {
		world = createWorld()
		const root = world.spawn(traits.Name('root'))
		const child = world.spawn(relations.ChildOf(root))
		const grandchild = world.spawn(relations.ChildOf(child))

		hierarchy.destroyEntityTree(world, root)

		expect(root.isAlive()).toBe(false)
		expect(child.isAlive()).toBe(false)
		expect(grandchild.isAlive()).toBe(false)
	})

	it('leaves siblings outside the subtree alone', () => {
		world = createWorld()
		const root = world.spawn(traits.Name('root'))
		const sibling = world.spawn(traits.Name('sibling'))
		const child = world.spawn(relations.ChildOf(root))

		hierarchy.destroyEntityTree(world, root)

		expect(sibling.isAlive()).toBe(true)
		expect(child.isAlive()).toBe(false)
	})
})
