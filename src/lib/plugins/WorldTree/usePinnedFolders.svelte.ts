import { MachineConnectionEvent } from '@viamrobotics/sdk'
import { useConnectionStatus } from '@viamrobotics/svelte-sdk'

import { useFrames } from '$lib/hooks/useFrames.svelte'
import { usePartID } from '$lib/hooks/usePartID.svelte'
import { usePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'

import type { PinnedFolders } from './buildTree'
import type { TreeFolderId } from './treeFolders'

/**
 * Folders the tree keeps even when they are empty, and the note each shows in
 * place of its rows. Frames stays while the machine is connected, so a machine
 * with no frames reads as that instead of as frames that failed to load.
 * Point clouds stays while the machine has a camera, and point cloud objects
 * while it has a vision service. Neither checks `getProperties`, since some
 * cameras report no point cloud support and serve one anyway.
 */
export const usePinnedFolders = (): { readonly current: PinnedFolders } => {
	const partID = usePartID()
	const connectionStatus = useConnectionStatus(() => partID.current)
	const frames = useFrames()
	const pointclouds = usePointClouds()
	const pointcloudObjects = usePointcloudObjects()

	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)

	const framesPlaceholder = $derived.by(() => {
		if (frames.isLoadingMachineFrames) return 'Loading frames…'
		if (frames.machineFrameCount === 0) return 'This machine has no frames'
		return undefined
	})

	const current = $derived.by<PinnedFolders>(() => {
		const pinned = new Map<TreeFolderId, string | undefined>()

		if (!isConnected) return pinned

		pinned.set('frames', framesPlaceholder)

		if (pointclouds.cameras.length > 0) {
			pinned.set('pointclouds', 'No point clouds drawn')
		}

		if (pointcloudObjects.services.length > 0) {
			pinned.set('pointcloud-objects', 'No point cloud objects drawn')
		}

		return pinned
	})

	return {
		get current() {
			return current
		},
	}
}
