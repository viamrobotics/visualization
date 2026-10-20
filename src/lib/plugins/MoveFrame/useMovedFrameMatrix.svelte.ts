import type { commonApi } from '@viamrobotics/sdk'
import type { Matrix4 } from 'three'

import { createRobotQuery, useRobotClient } from '@viamrobotics/svelte-sdk'

import { RefetchRates } from '$lib/components/overlay/refetchRates'
import { RefreshRates, useSettings } from '$lib/hooks/useSettings.svelte'
import { Pose } from '$lib/math'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

export interface MovedFrameMatrix {
	readonly current: Matrix4 | undefined
}

/**
 * The world transform of the frame the motion service actually drives.
 *
 * For an arm, gantry, gripper or base the frame system reports the *mount*
 * under `<name>_origin` and the *end effector* under the bare component
 * name, and the bare name is what `MotionClient.move` takes. The scene
 * renders these components at their origin (see `usePoses`), so no entity
 * carries the end effector's transform. Ask the frame system for it
 * directly. Frames without a kinematic model resolve to the transform their
 * entity already has.
 *
 * Resolved against `world` so the gizmo can be dragged and committed in the one
 * space both ends agree on, with no `_origin` ambiguity in between.
 */
export const useMovedFrameMatrix = (
	partID: () => string,
	frameName: () => string,
	enabled: () => boolean
): MovedFrameMatrix => {
	const settings = useSettings()
	const client = useRobotClient(partID)
	const logs = useLogs()

	// Per call, not per module: two open panels each get their own, so neither
	// depends on the other's decode finishing first.
	const pose = new Pose()

	const interval = $derived(settings.current.refreshRates[RefreshRates.poses])

	const query = createRobotQuery(
		client,
		'getPose',
		() => [frameName(), 'world', []] as [string, string, commonApi.Transform[]],
		() => ({
			enabled: enabled() && partID() !== '',
			// The chosen refresh rate is the only thing that polls this pose. Focus is
			// not: `Manual` leaves the query enabled with no interval.
			refetchOnWindowFocus: false,
			refetchInterval:
				interval === RefetchRates.OFF || interval === RefetchRates.MANUAL
					? (false as const)
					: interval,
		})
	)

	// The gizmo just renders nothing when this fails, which reads as the frame
	// having no transform rather than as an error.
	$effect(() => {
		if (!query.error) return

		logs.add(`Error fetching pose for ${frameName()}: ${query.error.message}`, 'error', {
			resource: frameName(),
			folder: 'frames',
		})
	})

	const current = $derived.by(() => {
		const worldPose = query.data?.pose
		return worldPose ? pose.copy(worldPose).toMatrix4() : undefined
	})

	return {
		get current() {
			return current
		},
	}
}
