import { traits } from '$lib/ecs'
import type { Entity, QueryResult, Trait } from 'koota'

export interface TreeNode {
	entity: Entity
	children?: TreeNode[]
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (entities: QueryResult<[Trait<() => string>]>): TreeNode[] => {
	const nodeMap = new Map<string, TreeNode>()
	const rootNodes: TreeNode[] = []
	const childNodes: TreeNode[] = []

	for (const entity of entities) {
		const parent = entity.get(traits.Parent)
		const name = entity.get(traits.Name) ?? ''
		const node: TreeNode = { entity }

		nodeMap.set(name, node)

		if (!parent || parent === 'world') {
			rootNodes.push(node)
		} else {
			childNodes.push(node)
		}
	}

	for (const node of childNodes) {
		const parent = node.entity.get(traits.Parent)

		if (parent) {
			const parentNode = nodeMap.get(parent)

			if (parentNode) {
				parentNode.children ??= []
				parentNode.children?.push(node)
			}
		}
	}

	return rootNodes
}
