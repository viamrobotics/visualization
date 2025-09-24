import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { usePartID } from './usePartID.svelte'
import { MotionClient } from '@viamrobotics/sdk'
import { createQuery, queryOptions } from '@tanstack/svelte-query'
import { useMachineSettings } from './useMachineSettings.svelte'
import { fromStore, toStore } from 'svelte/store'
import { useMotionClient } from './useMotionClient.svelte'

export const usePose = (name: () => string, parent: () => string | undefined) => {
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const motionClient = useMotionClient()
	const resources = useResourceNames(() => partID.current)
	const resource = $derived(resources.current.find((resource) => resource.name === name()))

	const client = createResourceClient(
		MotionClient,
		() => partID.current,
		() => motionClient.current ?? ''
	)

	const interval = $derived(refreshRates.get('Poses'))

	const options = $derived(
		queryOptions({
			enabled: interval !== -1 && client.current !== undefined && resource !== undefined,
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

				const pose = await client.current.getPose(resource.name, parent() ?? 'world', [])

				return pose
			},
		})
	)

	const query = fromStore(createQuery(toStore(() => options)))

	return {
		get current() {
			if (resource?.subtype === 'arm') {
				return
			}
			return query.current.data?.pose
		},
	}
}
