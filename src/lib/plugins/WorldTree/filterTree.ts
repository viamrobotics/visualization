import type { Entity } from 'koota'

import { traits } from '$lib/ecs'

import type { TreeNode } from './buildTree'

const matchesName = (node: TreeNode, needle: string): boolean =>
	(node.entity.get(traits.Name) ?? '').toLowerCase().includes(needle)

const countRows = (nodes: TreeNode[]): number =>
	nodes.reduce((total, node) => total + 1 + countRows(node.children ?? []), 0)

const keepMatching = (
	nodes: TreeNode[],
	needle: string,
	selected: ReadonlySet<Entity>
): TreeNode[] => {
	const kept: TreeNode[] = []

	for (const node of nodes) {
		// A match keeps its whole subtree. Filtering to a frame that owns geometry
		// should still show the geometry, which never carries the frame's name.
		if (selected.has(node.entity) || matchesName(node, needle)) {
			kept.push(node)
			continue
		}

		const children = keepMatching(node.children ?? [], needle, selected)
		if (children.length === 0) continue

		kept.push(
			node.folder
				? { ...node, children, folder: { ...node.folder, itemCount: countRows(children) } }
				: { ...node, children }
		)
	}

	return kept
}

/**
 * Rows whose name contains `query`, matched case-insensitively, plus the ancestors
 * that lead to them. A folder kept only for its descendants is recounted over what
 * survived, so its row never claims more than it shows.
 *
 * A row in `selected` is kept whether or not it matches. Picking an object in the
 * scene has to reach the tree, and clearing the query the user typed to get there
 * would cost them more than showing one extra row.
 *
 * An empty or whitespace-only query hands back `nodes` itself, leaving the
 * unfiltered tree's node identities intact.
 */
export const filterTree = (
	nodes: TreeNode[],
	query: string,
	selected: ReadonlySet<Entity>
): TreeNode[] => {
	const needle = query.trim().toLowerCase()
	return needle === '' ? nodes : keepMatching(nodes, needle, selected)
}
