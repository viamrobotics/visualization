import { traits } from '$lib/ecs'
import type { Entity, QueryResult, Trait } from 'koota'

export interface TreeNode {
	entity: Entity
	children?: TreeNode[]
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (entities: QueryResult<[Trait]>): TreeNode[] => {
	const nodeMap = new Map<string, TreeNode>()
	const rootNodes: TreeNode[] = []
	const childNodes: TreeNode[] = []

	for (const entity of entities) {
		const localParent = entity.get(traits.EditedParent)
		const name = entity.get(traits.Name) ?? ''
		const node: TreeNode = { entity }

		nodeMap.set(name, node)

		if (!localParent || localParent === 'world') {
			rootNodes.push(node)
		} else {
			childNodes.push(node)
		}
	}

	for (const node of childNodes) {
		const localParent = node.entity.get(traits.EditedParent)

		if (localParent) {
			const parentNode = nodeMap.get(localParent)

			if (parentNode) {
				parentNode.children ??= []
				parentNode.children?.push(node)
			}
		}
	}

	return rootNodes
}
