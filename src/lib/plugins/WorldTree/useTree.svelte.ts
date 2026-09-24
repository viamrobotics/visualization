import { IsExcluded } from 'koota'
import { createSubscriber } from 'svelte/reactivity'

import { relations, traits, useWorld } from '$lib/ecs'

import type { Tree, TreeNode } from './buildTree'

import { buildTree } from './buildTree'
import { treeFolders } from './treeFolders'

/**
 * Reactive scene tree, grouped into `treeFolders`. Rebuilds when any named entity
 * is added, removed, renamed, or gains or loses a `ChildOf` or `Orphan` edge.
 * Rebuild notifications are throttled to at most one per 100ms, so bursts of
 * world-state churn stay off the frame budget.
 */
export const useTree = (): {
	readonly current: TreeNode[]
	readonly parents: Map<string, string>
} => {
	const world = useWorld()

	// `IsExcluded` keeps the folder rows out of every query, including this hook's own.
	const folderEntities = treeFolders.map((folder) =>
		world.spawn(IsExcluded, traits.Name(folder.name))
	)

	let cached: Tree | undefined
	let dirty = true

	const subscribe = createSubscriber((update) => {
		// The world-state stream can churn dozens of entities per second, so
		// notifications coalesce to one per 100ms, leading edge plus a trailing
		// flush. `dirty` is set eagerly, so a read is never stale.
		let timer: ReturnType<typeof setTimeout> | undefined
		let trailing = false

		const flush = () => {
			update()
			timer = setTimeout(() => {
				timer = undefined
				if (trailing) {
					trailing = false
					flush()
				}
			}, 100)
		}

		const invalidate = () => {
			dirty = true
			if (timer === undefined) {
				flush()
			} else {
				trailing = true
			}
		}

		const unsubs = [
			world.onAdd(traits.Name, invalidate),
			world.onRemove(traits.Name, invalidate),
			world.onChange(traits.Name, invalidate),
			world.onAdd(relations.ChildOf, invalidate),
			world.onChange(relations.ChildOf, invalidate),
			world.onRemove(relations.ChildOf, invalidate),
			world.onAdd(traits.Orphan, invalidate),
			world.onRemove(traits.Orphan, invalidate),
		]

		return () => {
			if (timer !== undefined) clearTimeout(timer)
			for (const unsub of unsubs) unsub()
		}
	})

	const read = (): Tree => {
		subscribe()

		if (dirty || !cached) {
			cached = buildTree(world, folderEntities)
			dirty = false
		}

		return cached
	}

	return {
		get current() {
			return read().nodes
		},
		get parents() {
			return read().parents
		},
	}
}
