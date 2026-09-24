import type { Trait } from 'koota'

import type { RefreshRateId } from '$lib/hooks/useSettings.svelte'

import { traits } from '$lib/ecs'

/** Stable key for a folder, independent of its display name. */
export type TreeFolderId =
	| 'frames'
	| 'frameless-components'
	| 'pointclouds'
	| 'pointcloud-objects'
	| 'world-state-store'
	| 'drawn'
	| 'imported-files'
	| 'other'

export interface TreeFolder {
	/** What a log line names when it is about this folder's API rather than one resource. */
	id: TreeFolderId
	name: string
	sources: Trait[]
	/** Starts closed instead of open, for a folder that is a side note. */
	collapsed?: boolean
	/** Rows here have no scene object, so they get no visibility toggle. */
	sceneless?: boolean
	/** Poll that fills the folder, which puts refresh controls on its row. */
	refreshRate?: RefreshRateId
}

/** Display order. The last entry has no sources and claims whatever the others don't. */
export const treeFolders: TreeFolder[] = [
	{ id: 'frames', name: 'Frames', sources: [traits.FramesAPI], refreshRate: 'poses' },
	{
		id: 'frameless-components',
		name: 'Frameless components',
		sources: [traits.FramelessComponent],
		collapsed: true,
		sceneless: true,
	},
	{
		id: 'pointclouds',
		name: 'Point clouds',
		sources: [traits.PointCloudAPI],
		refreshRate: 'pointclouds',
	},
	{
		id: 'pointcloud-objects',
		name: 'Point cloud objects',
		sources: [traits.PointCloudObjectAPI],
		refreshRate: 'vision',
	},
	{ id: 'world-state-store', name: 'World state store', sources: [traits.WorldStateStoreAPI] },
	{ id: 'drawn', name: 'Drawn', sources: [traits.DrawAPI, traits.SnapshotAPI] },
	{ id: 'imported-files', name: 'Imported files', sources: [traits.DroppedFile] },
	{ id: 'other', name: 'Other', sources: [] },
]
