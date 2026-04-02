import type { Entity, QueryResult, Trait } from 'koota'

import { traits } from '$lib/ecs'

export interface TreeNode {
	entity: Entity
	parent?: TreeNode
	children?: TreeNode[]
}

function sortNodes(nodes: TreeNode[]) {
	nodes.sort(
		(a, b) => a.entity.get(traits.Name)?.localeCompare(b.entity.get(traits.Name) ?? '') ?? 0
	)
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (entities: QueryResult<[Trait]>) => {
	const nodeMap: Record<string, TreeNode | undefined> = {}
	const rootNodes: TreeNode[] = []
	const childNodes: TreeNode[] = []

	for (const entity of entities) {
		const parent = entity.get(traits.Parent)
		const name = entity.get(traits.Name) ?? ''
		const node: TreeNode = { entity }

		nodeMap[name] = node

		if (!parent || parent === 'world') {
			rootNodes.push(node)
		} else {
			childNodes.push(node)
		}
	}

	for (const node of childNodes) {
		const parent = node.entity.get(traits.Parent)

		if (parent) {
			const parentNode = nodeMap[parent]

			node.parent = parentNode

			if (parentNode) {
				parentNode.children ??= []
				parentNode.children?.push(node)
			}
		}
	}

	for (const node of rootNodes) {
		if (!node.children) continue
		sortNodes(node.children)
	}

	for (const node of childNodes) {
		if (!node.children) continue
		sortNodes(node.children)
	}

	sortNodes(rootNodes)
	sortNodes(childNodes)

	return { rootNodes, nodeMap }
}
