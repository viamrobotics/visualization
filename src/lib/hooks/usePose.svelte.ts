import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'
import { usePartID } from './usePartID.svelte'
import { MotionClient, Pose, Transform } from '@viamrobotics/sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useMotionClient } from './useMotionClient.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { observe } from '@threlte/core'
import { untrack } from 'svelte'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useLogs } from './useLogs.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { useRefetchPoses } from './useRefetchPoses'

export const usePose = (name: () => string | undefined, parent: () => string | undefined) => {
	const environment = useEnvironment()
	const logs = useLogs()
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const motionClient = useMotionClient()
	const currentName = $derived(name())
	const currentParent = $derived(parent())
	const resourceByName = useResourceByName()
	const { addQueryToRefetch } = useRefetchPoses()

	const resource = $derived(currentName ? resourceByName.current[currentName] : undefined)
	const parentResource = $derived(currentParent ? resourceByName.current[currentParent] : undefined)
	const frames = useFrames()
	let pose = $state<Pose | undefined>(undefined)

	const client = createResourceClient(
		MotionClient,
		() => partID.current,
		() => motionClient.current ?? ''
	)

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const resolvedParent = $derived(
		parentResource?.subtype === 'arm' ? `${parent()}_origin` : parent()
	)
	const query = createResourceQuery(
		client,
		'getPose',
		() => [currentName, resolvedParent ?? 'world', []] as [string, string, Transform[]],
		() => ({
			enabled: interval !== RefetchRates.OFF && environment.current.viewerMode === 'monitor',
			refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
		})
	)

	$effect(() => {
		if (environment.current.viewerMode === 'monitor') {
			pose = query.data?.pose
		}
	})

	$effect(() => addQueryToRefetch(query))

	$effect(() => {
		if (query.isFetching) {
			logs.add(`Fetching pose for ${currentName}...`)
		} else if (query.error) {
			logs.add(`Error fetching pose for ${currentName}: ${query.error.message}`, 'error')
		}
	})

	observe.pre(
		() => [environment.current.viewerMode, frames.current],
		() => {
			if (environment.current.viewerMode === 'monitor') {
				untrack(() => query.refetch())
			}
		}
	)

	return {
		get current() {
			/**
			 * Do not return the pose of an arm because in this case the pose represents
			 * the end effector frame and not the origin frame
			 */
			if (resource?.subtype === 'arm') {
				return
			}
			return pose
		},
	}
}
