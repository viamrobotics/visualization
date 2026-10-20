import { useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('pointcloud-object-context')

interface Context {
	refetch: () => void
	readonly services: string[]
	/** Each mounted vision service registers its own refetch here, keyed by partID:name. */
	readonly refetchers: Map<string, () => void>
}

export const providePointcloudObjects = (partID: () => string) => {
	const statuses = useResourceStatuses(partID, 'vision')
	const refetchers = new Map<string, () => void>()

	const services = $derived(
		statuses.current
			.map((status) => status.name?.name)
			.filter((name): name is string => name !== undefined)
	)

	setContext<Context>(key, {
		refetch() {
			for (const refetch of refetchers.values()) {
				refetch()
			}
		},
		get services() {
			return services
		},
		refetchers,
	})
}

export const usePointcloudObjects = () => {
	return getContext<Context>(key)
}
