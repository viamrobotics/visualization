import { PersistedState } from 'runed'

/**
 * Which world-tree folders the user left open. Keyed by folder name because entity
 * ids are handed out fresh each session, so nothing else survives a reload.
 *
 * Module scope rather than a context: the tree renders through a Threlte
 * `PortalTarget`, so `Tree.svelte` is instantiated under the portal's ancestors and
 * never sees a context set in `WorldTree.svelte`. `PersistedState` no-ops without a
 * `window`, the same as `useControlWidgets.svelte.ts`.
 */
const stored = new PersistedState<Record<string, boolean>>('world-tree-expanded-folders', {})

// `PersistedState.current` hands back whatever `JSON.parse` produced, and yields
// `undefined` when the stored entry fails to parse at all.
const readRecord = (): Record<string, boolean> => {
	const value: unknown = stored.current
	return typeof value === 'object' && value !== null ? (value as Record<string, boolean>) : {}
}

/** `collapsedByDefault` answers for a folder the user has never toggled. */
export const isFolderExpanded = (name: string, collapsedByDefault: boolean): boolean =>
	readRecord()[name] ?? !collapsedByDefault

/** Merges, so a folder that claims nothing right now keeps its stored state. */
export const mergeExpandedFolders = (expandedByName: Record<string, boolean>): void => {
	stored.current = { ...readRecord(), ...expandedByName }
}
