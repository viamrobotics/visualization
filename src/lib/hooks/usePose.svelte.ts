import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { usePartID } from './usePartID.svelte'
import { MotionClient } from '@viamrobotics/sdk'
import { createQuery, queryOptions } from '@tanstack/svelte-query'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { fromStore, toStore } from 'svelte/store'
import { useMotionClient } from './useMotionClient.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { observe } from '@threlte/core'
import { untrack } from 'svelte'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useLogs } from './useLogs.svelte'

export const usePose = (name: () => string, parent: () => string | undefined) => {
	const logs = useLogs()
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const motionClient = useMotionClient()
	const resources = useResourceNames(() => partID.current)

	const resource = $derived(resources.current.find((resource) => resource.name === name()))
	const parentResource = $derived(resources.current.find((resource) => resource.name === parent()))
	const environment = useEnvironment()
	const frames = useFrames()

	const client = createResourceClient(
		MotionClient,
		() => partID.current,
		() => motionClient.current ?? ''
	)

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const options = $derived(
		queryOptions({
			enabled:
				interval !== RefetchRates.OFF &&
				client.current !== undefined &&
				environment.current.viewerMode === 'monitor',
			refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
			queryKey: ['getPose', 'partID', partID.current, client.current?.name, name(), parent()],
			queryFn: async () => {
				if (!client.current) {
					throw new Error('No client')
				}

				logs.add(`Fetching pose for ${name()}...`)

				const resolvedParent = parentResource?.subtype === 'arm' ? `${parent()}_origin` : parent()
				const pose = await client.current.getPose(name(), resolvedParent ?? 'world', [])

				return pose
			},
		})
	)

	const query = fromStore(createQuery(toStore(() => options)))

	observe.pre(
		() => [environment.current.viewerMode, frames.current],
		() => {
			if (environment.current.viewerMode === 'monitor') {
				untrack(() => query.current).refetch()
			}
		}
	)

	$effect(() => {
		if (query.current.error) {
			logs.add(query.current.error.message, 'error')
		}
	})

	return {
		get current() {
			/**
			 * Do not return the pose of an arm because in this case the pose represents
			 * the end effector frame and not the origin frame
			 */
			if (resource?.subtype === 'arm') {
				return
			}
			return query.current.data?.pose
		},
	}
}
