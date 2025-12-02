import type { useWorldStates } from '$lib/hooks/useWorldState.svelte'
import type { WorldObject } from '$lib/WorldObject.svelte'
import type { Snapshot } from '$lib/gen/draw/v1/snapshot_pb'
import { drawingWithUUID, fromDrawing, fromTransform } from '$lib/WorldObject.svelte'
import { transformWithUUID } from '@viamrobotics/sdk'

export interface TreeNode {
	id: string
	name: string
	children?: TreeNode[]
	href: string
}

// Sort all nodes naturally by name
const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
	return nodes
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
		.map((node) => {
			if (node.children && node.children.length > 0) {
				node.children = sortNodes(node.children)
			}
			return node
		})
}

/**
 * Creates a tree representing parent child / relationships from a set of frames.
 */
export const buildTreeNodes = (
	objects: WorldObject[],
	worldStates: ReturnType<typeof useWorldStates>['current'],
	snapshot?: Snapshot
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
		if (object.referenceFrame && object.referenceFrame !== 'world') {
			const parentNode = nodeMap.get(object.referenceFrame)
			const child = nodeMap.get(object.name)
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

	// Add snapshot objects if available
	if (snapshot) {
		// Convert transforms and drawings to WorldObjects
		const transforms = snapshot.transforms.map((t) => fromTransform(transformWithUUID(t)))
		const drawings = snapshot.drawings.map((d) => fromDrawing(drawingWithUUID(d)))
		const snapshotObjects = [...transforms, ...drawings]

		// Create nodes for all snapshot objects
		for (const object of snapshotObjects) {
			const node: TreeNode = {
				name: object.name,
				id: `snapshot-${object.uuid}`,
				children: [],
				href: `/snapshot/${object.name}`,
			}

			nodeMap.set(object.name, node)

			// If it's a world-level object, add directly to snapshot node
			if (object.referenceFrame === 'world') {
				rootNodes.push(node)
			}
		}

		// Build hierarchy for non-world objects
		for (const object of snapshotObjects) {
			if (object.referenceFrame && object.referenceFrame !== 'world') {
				const parentNode = nodeMap.get(object.referenceFrame)
				const child = nodeMap.get(object.name)
				if (parentNode && child) {
					parentNode.children?.push(child)
				}
			}
		}
	}

	return sortNodes(rootNodes)
}
