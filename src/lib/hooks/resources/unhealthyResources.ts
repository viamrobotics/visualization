import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'

/** A resource the machine reports as unhealthy, with the error it reported. */
export interface UnhealthyResource {
	name: string
	error: string
}

/**
 * Resources the machine currently reports as unhealthy.
 *
 * `getPose` resolves through the frame system's `CurrentInputs`, which polls
 * *every* input-enabled component before it transforms anything — so a single
 * unhealthy arm fails the pose query for every frame in the scene, not just its
 * own. That makes these the likely explanation whenever poses stop updating.
 *
 * The proto guarantees `error` is set whenever a resource is unhealthy, so the
 * machine's own message is the best explanation available.
 */
export const unhealthyResources = (resources: ResourceStatus[] = []): UnhealthyResource[] =>
	resources
		.filter(({ state }) => state === robotApi.ResourceStatus_State.UNHEALTHY)
		.map(({ name, error }) => ({
			name: name?.name ?? 'unknown resource',
			error: error.trim(),
		}))
