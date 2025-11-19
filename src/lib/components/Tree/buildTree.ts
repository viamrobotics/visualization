import { traits } from '$lib/ecs'
import type { useWorldStates } from '$lib/hooks/useWorldState.svelte'
import type { WorldObject } from '$lib/WorldObject.svelte'
import type { Entity, QueryResult } from 'koota'

export interface TreeNode {
	id: string
	name: string
	children?: TreeNode[]
	href: string
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (
	entities: QueryResult,
	worldStates: ReturnType<typeof useWorldStates>['current']
): TreeNode[] => {
	const nodeMap = new Map<string, TreeNode>()
	const rootNodes = []

	for (const entity of entities) {
		const name = entity.get(traits.Name)
		const id = entity.get(traits.UUID)

		if (!name || !id) continue

		const node: TreeNode = {
			name,
			id,
			children: [],
			href: `/selection/${name}`,
		}

		nodeMap.set(name, node)

		if (entity.get(traits.Parent) === 'world') {
			rootNodes.push(node)
		}
	}

	for (const entity of entities) {
		const name = entity.get(traits.Name)
		const parent = entity.get(traits.Parent)

		if (!name) continue

		if (parent && parent !== 'world') {
			const parentNode = nodeMap.get(parent)
			const child = nodeMap.get(name)
			if (parentNode && child) {
				parentNode.children?.push(child)
			}
		}
	}

	for (const worldState of Object.values(worldStates)) {
		const node: TreeNode = {
			name: worldState.name,
			id: worldState.name,
			children: [],
			href: `/world-state/${worldState.name}`,
		}

		for (const object of worldState.worldObjects) {
			const child: TreeNode = {
				name: object.name,
				id: object.uuid,
				children: [],
				href: `/world-state/${worldState.name}/${object.name}`,
			}

			const parentNode =
				object.referenceFrame && nodeMap.has(object.referenceFrame)
					? nodeMap.get(object.referenceFrame)!
					: node

			nodeMap.set(object.name, child)
			parentNode.children?.push(child)
		}

		nodeMap.set(worldState.name, node)
		rootNodes.push(node)
	}

	return rootNodes
}
