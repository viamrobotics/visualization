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

export const usePose = (name: () => string, parent: () => string | undefined) => {
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const motionClient = useMotionClient()
	const resources = useResourceNames(() => partID.current)

	const resource = $derived(resources.current.find((resource) => resource.name === name()))
	const parentResource = $derived(resources.current.find((resource) => resource.name === parent()))
	const environment = useEnvironment()

	const client = createResourceClient(
		MotionClient,
		() => partID.current,
		() => motionClient.current ?? ''
	)

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const options = $derived(
		queryOptions({
			enabled:
				interval !== -1 &&
				client.current !== undefined &&
				resource !== undefined &&
				environment.current.viewerMode === 'monitor',
			refetchInterval: interval === 0 ? false : interval,
			queryKey: [
				'partID',
				partID.current,
				client.current?.name,
				'getPose',
				resource?.name,
				parent(),
			],
			queryFn: async () => {
				if (!client.current || !resource) {
					throw new Error('No client')
				}

				const resolvedParent = parentResource?.subtype === 'arm' ? `${parent()}_origin` : parent()
				const pose = await client.current.getPose(resource.name, resolvedParent ?? 'world', [])

				return pose
			},
		})
	)

	const query = fromStore(createQuery(toStore(() => options)))

	observe.pre(
		() => [environment.current.viewerMode],
		() => {
			if (environment.current.viewerMode === 'monitor') {
				untrack(() => query.current).refetch()
			}
		}
	)

	return {
		get current() {
			if (resource?.subtype === 'arm') {
				return
			}
			return query.current.data?.pose
		},
	}
}
