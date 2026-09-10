import { createWorld, type Entity, IsExcluded, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { relations, traits } from '$lib/ecs'

import { buildTree, type TreeNode } from '../buildTree'
import { treeFolders } from '../treeFolders'

let world: World
afterEach(() => world?.destroy())

const spawnFolderEntities = (): Entity[] =>
	treeFolders.map((folder) => world.spawn(IsExcluded, traits.Name(folder.name)))

const folderNamed = (nodes: TreeNode[], name: string): TreeNode | undefined =>
	nodes.find((node) => node.entity.get(traits.Name) === name)

const namesIn = (node: TreeNode | undefined): string[] =>
	(node?.children ?? []).map((child) => child.entity.get(traits.Name) ?? '')

describe('buildTree', () => {
	it('groups entities under the folder holding their source trait', () => {
		world = createWorld()
		world.spawn(traits.Name('arm'), traits.FramesAPI)
		world.spawn(traits.Name('cam1 pointcloud'), traits.PointCloudAPI)
		world.spawn(traits.Name('obstacle'), traits.WorldStateStoreAPI)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(namesIn(folderNamed(nodes, 'Frames'))).toEqual(['arm'])
		expect(namesIn(folderNamed(nodes, 'Point clouds'))).toEqual(['cam1 pointcloud'])
		expect(namesIn(folderNamed(nodes, 'World state store'))).toEqual(['obstacle'])
	})

	it('folds the draw service and snapshot sources into Drawn', () => {
		world = createWorld()
		world.spawn(traits.Name('b'), traits.DrawAPI)
		world.spawn(traits.Name('c'), traits.SnapshotAPI)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(namesIn(folderNamed(nodes, 'Drawn'))).toEqual(['b', 'c'])
	})

	it('marks a collapsed folder so the tree starts it closed', () => {
		world = createWorld()
		world.spawn(traits.Name('base-1'), traits.FramelessComponent)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(folderNamed(nodes, 'Frameless components')?.folder?.collapsed).toBe(true)
	})

	it('marks the rows of a sceneless folder, which drops their visibility toggle', () => {
		world = createWorld()
		world.spawn(traits.Name('base-1'), traits.FramelessComponent)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(folderNamed(nodes, 'Frameless components')?.children?.[0]?.sceneless).toBe(true)
	})

	it('omits folders that claim nothing', () => {
		world = createWorld()
		world.spawn(traits.Name('arm'), traits.FramesAPI)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(nodes.map((node) => node.entity.get(traits.Name))).toEqual(['Frames'])
	})

	it('counts every entity in a folder, not just the rows directly under it', () => {
		world = createWorld()
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const upper = world.spawn(traits.Name('arm:upper'), traits.FramesAPI, relations.ChildOf(arm))
		world.spawn(traits.Name('arm:lower'), traits.FramesAPI, relations.ChildOf(upper))

		const { nodes } = buildTree(world, spawnFolderEntities())
		const frames = folderNamed(nodes, 'Frames')

		expect(namesIn(frames)).toEqual(['arm'])
		expect(frames?.folder?.itemCount).toBe(3)
	})

	it('keeps ChildOf nesting when parent and child share a folder', () => {
		world = createWorld()
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		world.spawn(traits.Name('arm:upper'), traits.FramesAPI, relations.ChildOf(arm))

		const { nodes } = buildTree(world, spawnFolderEntities())
		const frames = folderNamed(nodes, 'Frames')

		expect(namesIn(frames)).toEqual(['arm'])
		expect(namesIn(frames?.children?.[0])).toEqual(['arm:upper'])
	})

	it('lifts a cross-folder child to its own folder and records the parent name', () => {
		world = createWorld()
		const cam = world.spawn(traits.Name('cam1'), traits.FramesAPI)
		const cloud = world.spawn(
			traits.Name('cam1 pointcloud'),
			traits.PointCloudAPI,
			relations.ChildOf(cam)
		)

		const { nodes } = buildTree(world, spawnFolderEntities())
		const clouds = folderNamed(nodes, 'Point clouds')

		expect(namesIn(folderNamed(nodes, 'Frames'))).toEqual(['cam1'])
		expect(namesIn(clouds)).toEqual(['cam1 pointcloud'])
		expect(clouds?.children?.[0]?.detachedParent).toBe(cam)
		// The relation itself has to survive — world matrices compose through it.
		expect(cloud.targetFor(relations.ChildOf)).toBe(cam)
	})

	it('gives an untagged child its parent folder and keeps it nested', () => {
		world = createWorld()
		const root = world.spawn(traits.Name('drawing'), traits.DrawAPI)
		world.spawn(traits.Name('drawing model 1'), relations.ChildOf(root))

		const { nodes } = buildTree(world, spawnFolderEntities())
		const drawn = folderNamed(nodes, 'Drawn')

		expect(namesIn(drawn)).toEqual(['drawing'])
		expect(namesIn(drawn?.children?.[0])).toEqual(['drawing model 1'])
	})

	it('inherits a folder through an untagged intermediate ancestor', () => {
		world = createWorld()
		const root = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const middle = world.spawn(traits.Name('middle'), relations.ChildOf(root))
		world.spawn(traits.Name('leaf'), relations.ChildOf(middle))

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(nodes.map((node) => node.entity.get(traits.Name))).toEqual(['Frames'])
	})

	it('groups a Gizmo entity under Gizmos rather than Other', () => {
		world = createWorld()
		world.spawn(traits.Name('translate handle'), traits.Gizmo)

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(namesIn(folderNamed(nodes, 'Gizmos'))).toEqual(['translate handle'])
		expect(namesIn(folderNamed(nodes, 'Other'))).toEqual([])
	})

	it('drops an entity with no tagged ancestor into Other', () => {
		world = createWorld()
		world.spawn(traits.Name('custom geometry 1'))

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(namesIn(folderNamed(nodes, 'Other'))).toEqual(['custom geometry 1'])
	})

	it('hides orphans until the resolver places them', () => {
		world = createWorld()
		world.spawn(traits.Name('pending'), traits.FramesAPI, traits.Orphan('arm'))

		const { nodes } = buildTree(world, spawnFolderEntities())

		expect(nodes).toEqual([])
	})

	it('maps each node to its drawn parent, topped by the folder row', () => {
		world = createWorld()
		const cam = world.spawn(traits.Name('cam1'), traits.FramesAPI)
		const cloud = world.spawn(
			traits.Name('cam1 pointcloud'),
			traits.PointCloudAPI,
			relations.ChildOf(cam)
		)

		const { nodes, parents } = buildTree(world, spawnFolderEntities())
		const clouds = folderNamed(nodes, 'Point clouds')

		expect(parents.get(`${cloud}`)).toBe(`${clouds?.entity}`)
		expect(parents.get(`${clouds?.entity}`)).toBeUndefined()
	})

	it('terminates on a ChildOf cycle', () => {
		world = createWorld()
		const a = world.spawn(traits.Name('a'))
		const b = world.spawn(traits.Name('b'), relations.ChildOf(a))
		a.add(relations.ChildOf(b))

		expect(() => buildTree(world, spawnFolderEntities())).not.toThrow()
	})
})
