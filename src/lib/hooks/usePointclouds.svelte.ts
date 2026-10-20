import { useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('pointcloud-context')

interface Context {
	refetch: () => void
	readonly cameras: string[]
	/** Each mounted camera registers its own refetch here, keyed by partID:name. */
	readonly refetchers: Map<string, () => void>
}

export const providePointclouds = (partID: () => string) => {
	const statuses = useResourceStatuses(partID, 'camera')
	const refetchers = new Map<string, () => void>()

	const cameras = $derived(
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
		get cameras() {
			return cameras
		},
		refetchers,
	})
}

export const usePointClouds = () => {
	return getContext<Context>(key)
}
