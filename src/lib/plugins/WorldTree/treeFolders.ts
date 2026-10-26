import type { Trait } from 'koota'

import type { RefreshRateId } from '$lib/hooks/useSettings.svelte'

import { traits } from '$lib/ecs'
import { Collision } from '$lib/plugins/Collisions/traits'

/** Stable key for a folder, independent of its display name. */
export type TreeFolderId =
	| 'frames'
	| 'missing-parent'
	| 'frameless-components'
	| 'pointclouds'
	| 'pointcloud-objects'
	| 'world-state-store'
	| 'collisions'
	| 'drawn'
	| 'imported-files'
	| 'other'

/** The settings a folder row opens: a polling group's, or the collision detector's. */
export type FolderSettingsId = RefreshRateId | 'collisions'

export interface TreeFolder {
	/** What a log line names when it is about this folder's API rather than one resource. */
	id: TreeFolderId
	name: string
	sources: Trait[]
	/** Starts closed instead of open, for a folder that is a side note. */
	collapsed?: boolean
	/** Rows here have no scene object, so they get no visibility toggle. */
	sceneless?: boolean
	/** What fills the folder, which puts its settings on the folder's row. */
	settings?: FolderSettingsId
}

/** Display order. The last entry has no sources and claims whatever the others don't. */
export const treeFolders: TreeFolder[] = [
	{ id: 'frames', name: 'Frames', sources: [traits.FramesAPI], settings: 'poses' },
	{
		id: 'collisions',
		name: 'Collisions',
		sources: [Collision],
		sceneless: true,
		settings: 'collisions',
	},
	{
		id: 'pointclouds',
		name: 'Point clouds',
		sources: [traits.PointCloudAPI],
		settings: 'pointclouds',
	},
	{
		id: 'pointcloud-objects',
		name: 'Point cloud objects',
		sources: [traits.PointCloudObjectAPI],
		settings: 'vision',
	},
	{ id: 'world-state-store', name: 'World state store', sources: [traits.WorldStateStoreAPI] },
	{
		id: 'frameless-components',
		name: 'Frameless components',
		sources: [traits.FramelessComponent],
		collapsed: true,
		sceneless: true,
	},
	{ id: 'drawn', name: 'Drawn', sources: [traits.DrawAPI, traits.SnapshotAPI] },
	{ id: 'imported-files', name: 'Imported files', sources: [traits.DroppedFile] },
	/**
	 * No sources because it claims by `Orphan` instead: every entity whose parent is
	 * not in the scene, whatever produced it, so it never passes for a root.
	 */
	{ id: 'missing-parent', name: 'Missing parent', sources: [], collapsed: true },
	{ id: 'other', name: 'Other', sources: [] },
]
