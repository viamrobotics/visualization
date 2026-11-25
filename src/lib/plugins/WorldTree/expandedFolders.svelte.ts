/**
 * The storage key for which world-tree folders the user left open, before any namespace. Keyed
 * by folder name because entity ids are handed out fresh each session, so nothing else survives
 * a reload.
 */
export const EXPANDED_FOLDERS_STORAGE_KEY = 'world-tree-expanded-folders'

interface ExpandedFolders {
	/** `collapsedByDefault` answers for a folder the user has never toggled. */
	isFolderExpanded: (name: string, collapsedByDefault: boolean) => boolean
	/** Merges, so a folder that claims nothing right now keeps its stored state. */
	mergeExpandedFolders: (expandedByName: Record<string, boolean>) => void
}

/** Reads and writes the open-folder record held in `stored`. */
export const createExpandedFolders = (stored: { current: unknown }): ExpandedFolders => {
	// `PersistedState.current` hands back whatever `JSON.parse` produced, and yields
	// `undefined` when the stored entry fails to parse at all.
	const readRecord = (): Record<string, boolean> => {
		const value = stored.current
		return typeof value === 'object' && value !== null ? (value as Record<string, boolean>) : {}
	}

	return {
		isFolderExpanded: (name, collapsedByDefault) => readRecord()[name] ?? !collapsedByDefault,
		mergeExpandedFolders: (expandedByName) => {
			stored.current = { ...readRecord(), ...expandedByName }
		},
	}
}
