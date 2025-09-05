import type { WorldObject } from '$lib/WorldObject.svelte'

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
	objects: WorldObject[],
	worldStates: { name: string; objects: WorldObject[] }[]
): TreeNode[] => {
	const nodeMap = new Map<string, TreeNode>()
	const rootNodes = []

	for (const object of objects) {
		const node: TreeNode = {
			name: object.name,
			id: object.uuid,
			children: [],
			href: `/selection/${object.name}`,
		}

		nodeMap.set(object.name, node)

		if (object.referenceFrame === 'world') {
			rootNodes.push(node)
		}
	}

	for (const object of objects) {
		if (object.referenceFrame !== 'world') {
			const parentNode = nodeMap.get(object.referenceFrame)
			const child = nodeMap.get(object.name)
			if (parentNode && child) {
				parentNode.children?.push(child)
			}
		}
	}

	for (const worldState of worldStates) {
		const node: TreeNode = {
			name: worldState.name,
			id: worldState.name,
			children: [],
			href: `/world-state/${worldState.name}`,
		}

		console.log('worldState', worldState)

		for (const object of worldState.objects) {
			const child: TreeNode = {
				name: object.name,
				id: object.uuid,
				children: [],
				href: `/world-state/${worldState.name}/${object.name}`,
			}

			nodeMap.set(object.name, child)
			node.children?.push(child)
			console.log('child', child)
		}

		nodeMap.set(worldState.name, node)
		rootNodes.push(node)
	}

	return rootNodes
}
