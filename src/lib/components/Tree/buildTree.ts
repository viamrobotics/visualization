import { traits } from '$lib/ecs'
import type { Entity, QueryResult } from 'koota'

export interface TreeNode {
	entity: Entity
	children?: TreeNode[]
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (entities: QueryResult): TreeNode[] => {
	const nodeMap = new Map<Entity, TreeNode>()
	const rootNodes = []

	for (const entity of entities) {
		const node: TreeNode = {
			entity,
			children: [],
		}

		nodeMap.set(entity, node)

		const parent = entity.get(traits.Parent)

		if (!parent || parent === 'world') {
			rootNodes.push(node)
		}
	}

	for (const entity of entities) {
		const parent = entity.get(traits.Parent)

		if (parent && parent !== 'world') {
			const parentNode = nodeMap.get(entity)
			const child = nodeMap.get(entity)
			if (parentNode && child) {
				parentNode.children ??= []
				parentNode.children?.push(child)
			}
		}
	}

	return rootNodes
}
