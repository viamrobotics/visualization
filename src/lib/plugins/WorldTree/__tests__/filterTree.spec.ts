import { createWorld, type Entity, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import type { TreeNode } from '../buildTree'

import { filterTree } from '../filterTree'

let world: World
afterEach(() => world?.destroy())

const NOTHING_SELECTED: ReadonlySet<Entity> = new Set()

const node = (name: string, children?: TreeNode[]): TreeNode => ({
	entity: world.spawn(traits.Name(name)),
	children,
})

const folder = (name: string, children: TreeNode[], itemCount: number): TreeNode => ({
	...node(name, children),
	folder: { id: 'frames', itemCount },
})

const namesIn = (nodes: TreeNode[]): string[] =>
	nodes.map((child) => child.entity.get(traits.Name) ?? '')

describe('filterTree', () => {
	it('hands back the same nodes when the query is only whitespace', () => {
		world = createWorld()
		const nodes = [node('arm')]

		expect(filterTree(nodes, '  ', NOTHING_SELECTED)).toBe(nodes)
	})

	it('keeps a row whose name contains the query in any casing', () => {
		world = createWorld()
		const nodes = [node('Arm'), node('gripper')]

		expect(namesIn(filterTree(nodes, 'aRm', NOTHING_SELECTED))).toEqual(['Arm'])
	})

	it('keeps an ancestor that leads to a match, dropping the branches that do not', () => {
		world = createWorld()
		const nodes = [node('base', [node('arm', [node('gripper')]), node('camera')])]

		const [base] = filterTree(nodes, 'gripper', NOTHING_SELECTED)

		expect(namesIn([base])).toEqual(['base'])
		expect(namesIn(base?.children ?? [])).toEqual(['arm'])
		expect(namesIn(base?.children?.[0]?.children ?? [])).toEqual(['gripper'])
	})

	it('keeps the whole subtree of a match, including children that do not match', () => {
		world = createWorld()
		const nodes = [node('arm', [node('link0'), node('link1')])]

		expect(namesIn(filterTree(nodes, 'arm', NOTHING_SELECTED)[0]?.children ?? [])).toEqual([
			'link0',
			'link1',
		])
	})

	it('drops a row that matches nothing', () => {
		world = createWorld()
		const nodes = [node('base', [node('arm')])]

		expect(filterTree(nodes, 'camera', NOTHING_SELECTED)).toEqual([])
	})

	it('keeps a selected row the query excludes, with the ancestors leading to it', () => {
		world = createWorld()
		const camera = node('camera')
		const nodes = [node('base', [node('arm'), camera])]

		const [base] = filterTree(nodes, 'nothing matches this', new Set([camera.entity]))

		expect(namesIn(base?.children ?? [])).toEqual(['camera'])
	})

	it('recounts a folder kept only for its descendants over the rows that survived', () => {
		world = createWorld()
		const nodes = [folder('Frames', [node('arm', [node('gripper')]), node('camera')], 3)]

		expect(filterTree(nodes, 'gripper', NOTHING_SELECTED)[0]?.folder?.itemCount).toBe(2)
	})

	it('leaves the count of a folder matched by name at its full total', () => {
		world = createWorld()
		const nodes = [folder('Frames', [node('arm'), node('camera')], 2)]

		expect(filterTree(nodes, 'frames', NOTHING_SELECTED)[0]?.folder?.itemCount).toBe(2)
	})
})
