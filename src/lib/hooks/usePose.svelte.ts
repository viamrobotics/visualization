import { createRobotQuery, useRobotClient } from '@viamrobotics/svelte-sdk'
import { usePartID } from './usePartID.svelte'
import { commonApi, Pose } from '@viamrobotics/sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { observe } from '@threlte/core'
import { untrack } from 'svelte'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useLogs } from './useLogs.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { useRefetchPoses } from './useRefetchPoses'

const origingFrameComponentTypes = ['arm', 'gantry', 'gripper', 'base']

export const usePose = (name: () => string | undefined, parent: () => string | undefined) => {
	const environment = useEnvironment()
	const logs = useLogs()
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const robotClient = useRobotClient(() => partID.current)
	const currentName = $derived(name())
	const currentParent = $derived(parent())
	const resourceByName = useResourceByName()
	const { addQueryToRefetch } = useRefetchPoses()

	const resource = $derived(currentName ? resourceByName.current[currentName] : undefined)
	const parentResource = $derived(currentParent ? resourceByName.current[currentParent] : undefined)
	const frames = useFrames()
	let pose = $state<Pose | undefined>(undefined)

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const resolvedParent = $derived(
		origingFrameComponentTypes.includes(parentResource?.subtype ?? '')
			? `${parent()}_origin`
			: parent()
	)

	const resolvedName = $derived(
		origingFrameComponentTypes.includes(resource?.subtype ?? '')
			? `${currentName}_origin`
			: currentName
	)

	const query = createRobotQuery(
		robotClient,
		'getPose',
		() => [resolvedName, resolvedParent ?? 'world', []] as [string, string, commonApi.Transform[]],
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
			return pose
		},
	}
}
