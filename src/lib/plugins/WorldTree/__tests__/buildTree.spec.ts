import { createWorld, type Entity, type Trait, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { relations, traits } from '#lib/ecs/index.js'

import { buildTree, type FallbackFolders, type TreeNode } from '../buildTree'

let world: World
afterEach(() => world?.destroy())

const spawnFolder = (
	name: string,
	order: number,
	sources: Trait[],
	options: { placeholder?: string; pinned?: boolean; collapsed?: boolean; sceneless?: boolean } = {}
): Entity =>
	world.spawn(
		traits.Folder({
			id: name.toLowerCase(),
			name,
			order,
			sources,
			placeholder: options.placeholder,
			pinned: options.pinned ?? false,
			collapsed: options.collapsed ?? false,
			sceneless: options.sceneless ?? false,
			refreshRate: undefined,
		})
	)

const spawnFallback = (): FallbackFolders => ({
	missingParent: spawnFolder('Missing parent', 0, [], { collapsed: true }),
	other: spawnFolder('Other', 0, []),
})

const folderNamed = (nodes: TreeNode[], name: string): TreeNode | undefined =>
	nodes.find((node) => node.folder?.name === name)

const namesIn = (node: TreeNode | undefined): string[] =>
	(node?.children ?? []).map((child) => child.entity.get(traits.Name) ?? '')

describe('buildTree', () => {
	it('groups entities under the folder holding their source trait', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		spawnFolder('Point clouds', 200, [traits.PointCloudAPI])
		world.spawn(traits.Name('arm'), traits.FramesAPI)
		world.spawn(traits.Name('cam1 pointcloud'), traits.PointCloudAPI)

		const { nodes } = buildTree(world, spawnFallback())

		expect(namesIn(folderNamed(nodes, 'Frames'))).toEqual(['arm'])
		expect(namesIn(folderNamed(nodes, 'Point clouds'))).toEqual(['cam1 pointcloud'])
	})

	it('orders folders by their order, whatever order they spawned in', () => {
		world = createWorld()
		spawnFolder('Drawn', 700, [traits.DrawAPI])
		spawnFolder('Frames', 100, [traits.FramesAPI])
		world.spawn(traits.Name('b'), traits.DrawAPI)
		world.spawn(traits.Name('arm'), traits.FramesAPI)

		const { nodes } = buildTree(world, spawnFallback())

		expect(nodes.map((node) => node.folder?.name)).toEqual(['Frames', 'Drawn'])
	})

	it('files an entity matching two folders under the lower order', () => {
		world = createWorld()
		spawnFolder('Frameless components', 600, [traits.FramelessComponent])
		spawnFolder('Saved poses', 500, [traits.SavedPose])
		world.spawn(traits.Name('saver'), traits.FramelessComponent, traits.SavedPose)

		const { nodes } = buildTree(world, spawnFallback())

		expect(nodes.map((node) => node.folder?.name)).toEqual(['Saved poses'])
	})

	it('claims every source a folder lists', () => {
		world = createWorld()
		spawnFolder('Drawn', 700, [traits.DrawAPI, traits.SnapshotAPI])
		world.spawn(traits.Name('b'), traits.DrawAPI)
		world.spawn(traits.Name('c'), traits.SnapshotAPI)

		const { nodes } = buildTree(world, spawnFallback())

		expect(namesIn(folderNamed(nodes, 'Drawn'))).toEqual(['b', 'c'])
	})

	it('carries a collapsed folder so the tree starts it closed', () => {
		world = createWorld()
		spawnFolder('Frameless components', 600, [traits.FramelessComponent], { collapsed: true })
		world.spawn(traits.Name('base-1'), traits.FramelessComponent)

		const { nodes } = buildTree(world, spawnFallback())

		expect(folderNamed(nodes, 'Frameless components')?.folder?.collapsed).toBe(true)
	})

	it('marks the rows of a sceneless folder, which drops their visibility toggle', () => {
		world = createWorld()
		spawnFolder('Frameless components', 600, [traits.FramelessComponent], { sceneless: true })
		world.spawn(traits.Name('base-1'), traits.FramelessComponent)

		const { nodes } = buildTree(world, spawnFallback())

		expect(folderNamed(nodes, 'Frameless components')?.children?.[0]?.sceneless).toBe(true)
	})

	it('omits folders that claim nothing', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		spawnFolder('Drawn', 700, [traits.DrawAPI])
		world.spawn(traits.Name('arm'), traits.FramesAPI)

		const { nodes } = buildTree(world, spawnFallback())

		expect(nodes.map((node) => node.folder?.name)).toEqual(['Frames'])
	})

	it('counts every entity in a folder, not just the rows directly under it', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const upper = world.spawn(traits.Name('arm:upper'), traits.FramesAPI, relations.ChildOf(arm))
		world.spawn(traits.Name('arm:lower'), traits.FramesAPI, relations.ChildOf(upper))

		const { nodes } = buildTree(world, spawnFallback())
		const frames = folderNamed(nodes, 'Frames')

		expect(namesIn(frames)).toEqual(['arm'])
		expect(frames?.folder?.itemCount).toBe(3)
	})

	it('keeps ChildOf nesting when parent and child share a folder', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		world.spawn(traits.Name('arm:upper'), traits.FramesAPI, relations.ChildOf(arm))

		const { nodes } = buildTree(world, spawnFallback())
		const frames = folderNamed(nodes, 'Frames')

		expect(namesIn(frames)).toEqual(['arm'])
		expect(namesIn(frames?.children?.[0])).toEqual(['arm:upper'])
	})

	it('sorts siblings by name at every depth, whatever order they spawned in', () => {
		world = createWorld()
		spawnFolder('Drawn', 700, [traits.DrawAPI])
		const zulu = world.spawn(traits.Name('zulu'), traits.DrawAPI)
		world.spawn(traits.Name('bravo'), traits.DrawAPI)
		const tango = world.spawn(traits.Name('tango'), traits.DrawAPI, relations.ChildOf(zulu))
		world.spawn(traits.Name('delta'), traits.DrawAPI, relations.ChildOf(zulu))
		world.spawn(traits.Name('sierra'), traits.DrawAPI, relations.ChildOf(tango))
		world.spawn(traits.Name('foxtrot'), traits.DrawAPI, relations.ChildOf(tango))

		const { nodes } = buildTree(world, spawnFallback())
		const drawn = folderNamed(nodes, 'Drawn')
		const zuluNode = drawn?.children?.[1]

		expect(namesIn(drawn)).toEqual(['bravo', 'zulu'])
		expect(namesIn(zuluNode)).toEqual(['delta', 'tango'])
		expect(namesIn(zuluNode?.children?.[1])).toEqual(['foxtrot', 'sierra'])
	})

	it('lifts a cross-folder child to its own folder and records the parent', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		spawnFolder('Point clouds', 200, [traits.PointCloudAPI])
		const cam = world.spawn(traits.Name('cam1'), traits.FramesAPI)
		const cloud = world.spawn(
			traits.Name('cam1 pointcloud'),
			traits.PointCloudAPI,
			relations.ChildOf(cam)
		)

		const { nodes } = buildTree(world, spawnFallback())
		const clouds = folderNamed(nodes, 'Point clouds')

		expect(namesIn(folderNamed(nodes, 'Frames'))).toEqual(['cam1'])
		expect(namesIn(clouds)).toEqual(['cam1 pointcloud'])
		expect(clouds?.children?.[0]?.detachedParent).toBe(cam)
		expect(cloud.targetFor(relations.ChildOf), 'world matrices compose through the relation').toBe(
			cam
		)
	})

	it('gives an untagged child its parent folder and keeps it nested', () => {
		world = createWorld()
		spawnFolder('Drawn', 700, [traits.DrawAPI])
		const root = world.spawn(traits.Name('drawing'), traits.DrawAPI)
		world.spawn(traits.Name('drawing model 1'), relations.ChildOf(root))

		const { nodes } = buildTree(world, spawnFallback())
		const drawn = folderNamed(nodes, 'Drawn')

		expect(namesIn(drawn)).toEqual(['drawing'])
		expect(namesIn(drawn?.children?.[0])).toEqual(['drawing model 1'])
	})

	it('inherits a folder through an untagged intermediate ancestor', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		const root = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const middle = world.spawn(traits.Name('middle'), relations.ChildOf(root))
		world.spawn(traits.Name('leaf'), relations.ChildOf(middle))

		const { nodes } = buildTree(world, spawnFallback())

		expect(nodes.map((node) => node.folder?.name)).toEqual(['Frames'])
	})

	it('drops an entity with no tagged ancestor into Other', () => {
		world = createWorld()
		world.spawn(traits.Name('custom geometry 1'))

		const { nodes } = buildTree(world, spawnFallback())

		expect(namesIn(folderNamed(nodes, 'Other'))).toEqual(['custom geometry 1'])
	})

	it('drops an entity into Other when no folder lists its source', () => {
		world = createWorld()
		world.spawn(traits.Name('drawing'), traits.DrawAPI)

		const { nodes } = buildTree(world, spawnFallback())

		expect(namesIn(folderNamed(nodes, 'Other'))).toEqual(['drawing'])
	})

	it('files an orphan under Missing parent rather than its source folder', () => {
		world = createWorld()
		spawnFolder('Point clouds', 200, [traits.PointCloudAPI])
		world.spawn(traits.Name('cam1 pointcloud'), traits.PointCloudAPI, traits.Orphan('cam1'))

		const { nodes } = buildTree(world, spawnFallback())

		expect(nodes.map((node) => node.folder?.name)).toEqual(['Missing parent'])
		expect(namesIn(folderNamed(nodes, 'Missing parent'))).toEqual(['cam1 pointcloud'])
	})

	it('names the parent an orphan is waiting for', () => {
		world = createWorld()
		world.spawn(traits.Name('cam1 pointcloud'), traits.PointCloudAPI, traits.Orphan('cam1'))

		const { nodes } = buildTree(world, spawnFallback())

		expect(folderNamed(nodes, 'Missing parent')?.children?.[0]?.missingParent).toBe('cam1')
	})

	it('keeps an orphan’s untagged descendants nested under it', () => {
		world = createWorld()
		const pending = world.spawn(traits.Name('drawing'), traits.DrawAPI, traits.Orphan('base'))
		world.spawn(traits.Name('drawing model 1'), relations.ChildOf(pending))

		const { nodes } = buildTree(world, spawnFallback())
		const missing = folderNamed(nodes, 'Missing parent')

		expect(namesIn(missing)).toEqual(['drawing'])
		expect(namesIn(missing?.children?.[0])).toEqual(['drawing model 1'])
	})

	it('maps each node to its drawn parent, topped by the folder row', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		const clouds = spawnFolder('Point clouds', 200, [traits.PointCloudAPI])
		const cam = world.spawn(traits.Name('cam1'), traits.FramesAPI)
		const cloud = world.spawn(
			traits.Name('cam1 pointcloud'),
			traits.PointCloudAPI,
			relations.ChildOf(cam)
		)

		const { parents } = buildTree(world, spawnFallback())

		expect(parents.get(`${cloud}`)).toBe(`${clouds}`)
		expect(parents.get(`${clouds}`)).toBeUndefined()
	})

	it('terminates on a ChildOf cycle', () => {
		world = createWorld()
		const a = world.spawn(traits.Name('a'))
		const b = world.spawn(traits.Name('b'), relations.ChildOf(a))
		a.add(relations.ChildOf(b))

		expect(() => buildTree(world, spawnFallback())).not.toThrow()
	})

	it('keeps an empty folder that has a placeholder, and carries it', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI], { placeholder: 'This machine has no frames' })

		const { nodes } = buildTree(world, spawnFallback())
		const frames = folderNamed(nodes, 'Frames')

		expect(frames?.children).toEqual([])
		expect(frames?.folder?.itemCount).toBe(0)
		expect(frames?.folder?.placeholder).toBe('This machine has no frames')
	})

	it('keeps an empty pinned folder that has no placeholder', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI], { pinned: true })

		const { nodes } = buildTree(world, spawnFallback())

		expect(folderNamed(nodes, 'Frames')?.children).toEqual([])
	})

	it('drops the placeholder once the folder has rows', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI], { placeholder: 'This machine has no frames' })
		world.spawn(traits.Name('arm'), traits.FramesAPI)

		const { nodes } = buildTree(world, spawnFallback())
		const frames = folderNamed(nodes, 'Frames')

		expect(namesIn(frames)).toEqual(['arm'])
		expect(frames?.folder?.placeholder).toBeUndefined()
	})

	it('rolls the worst descendant issue up to the folder, counting each entity once', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		world.spawn(
			traits.Name('arm:upper'),
			traits.FramesAPI,
			relations.ChildOf(arm),
			traits.Issues(
				new Map([
					['health', [{ severity: 'warn', message: 'unhealthy' }]],
					['logs', [{ severity: 'error', message: 'pose failed' }]],
				])
			)
		)
		world.spawn(
			traits.Name('gripper'),
			traits.FramesAPI,
			traits.Issues(new Map([['health', [{ severity: 'warn', message: 'unhealthy' }]]]))
		)

		const { nodes } = buildTree(world, spawnFallback())
		const frames = folderNamed(nodes, 'Frames')

		expect(frames?.rollup).toEqual({ severity: 'error', count: 2 })
		expect(frames?.children?.[0]?.rollup).toEqual({ severity: 'error', count: 1 })
	})

	it('leaves a row’s own issues out of its rollup', () => {
		world = createWorld()
		spawnFolder('Frames', 100, [traits.FramesAPI])
		world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Issues(new Map([['health', [{ severity: 'warn', message: 'unhealthy' }]]]))
		)

		const { nodes } = buildTree(world, spawnFallback())

		expect(folderNamed(nodes, 'Frames')?.children?.[0]?.rollup).toBeUndefined()
	})
})
