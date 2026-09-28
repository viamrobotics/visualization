import { CameraClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceStatuses,
} from '@viamrobotics/svelte-sdk'

import { usePartID } from '$lib/hooks/usePartID.svelte'

import { frustumPositions } from './frustumPositions'

export interface CameraFrustum {
	/** The camera resource's name, which is also the name of its frame. */
	name: string
	/** Line-segment endpoints for the wireframe, in the camera frame's coordinates. */
	positions: Float32Array
}

export interface CameraFrustaOptions {
	/** Whether to query the part's cameras at all. */
	enabled: () => boolean
	/** Far-plane depth, in metres. */
	range: () => number
}

/**
 * Every camera on the current part whose reported intrinsics describe a frustum, paired
 * with the wireframe to draw for it. A camera that reports no intrinsics is absent from
 * the list — there is nothing truthful to draw for it.
 *
 * What the caller then chooses to show is the caller's own business; this reports only
 * what is drawable.
 *
 * Must be called during setup, inside `<SceneProviders>`.
 */
export const useCameraFrusta = ({ enabled, range }: CameraFrustaOptions) => {
	const partID = usePartID()
	const statuses = useResourceStatuses(() => partID.current, 'camera')

	const names = $derived(
		statuses.current
			.map((status) => status.name?.name)
			.filter((name): name is string => name !== undefined)
	)

	const clients = $derived(
		names.map((name) =>
			createResourceClient(
				CameraClient,
				() => partID.current,
				() => name
			)
		)
	)

	// Intrinsics are fixed for the life of a camera, so the reply is fetched once and
	// never polled.
	const queries = $derived(
		clients.map(
			(client) =>
				[
					client.name,
					createResourceQuery(client, 'getProperties', () => ({
						refetchInterval: false,
						enabled: enabled(),
					})),
				] as const
		)
	)

	const current = $derived.by(() => {
		const frusta: CameraFrustum[] = []

		for (const [name, query] of queries) {
			const intrinsics = query.data?.intrinsicParameters
			if (!intrinsics) continue

			const positions = frustumPositions(intrinsics, 0, range())
			if (!positions) continue

			frusta.push({ name, positions })
		}

		return frusta
	})

	return {
		get current() {
			return current
		},
		/** Every camera on the part, drawable or not, for the settings panel's list. */
		get names() {
			return names
		},
	}
}
