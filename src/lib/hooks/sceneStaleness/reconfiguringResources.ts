import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'

/** A resource the machine has started applying a config to but not finished. */
export interface ReconfiguringResource {
	name: string
	state: 'unconfigured' | 'configuring' | 'removing'
}

const stateLabel = (
	state: robotApi.ResourceStatus_State
): ReconfiguringResource['state'] | undefined => {
	switch (state) {
		case robotApi.ResourceStatus_State.UNCONFIGURED: {
			return 'unconfigured'
		}
		case robotApi.ResourceStatus_State.CONFIGURING: {
			return 'configuring'
		}
		case robotApi.ResourceStatus_State.REMOVING: {
			return 'removing'
		}
		default: {
			return undefined
		}
	}
}

/**
 * Resources the machine has not finished settling.
 *
 * A component joins the frame system only once it configures, so a newly added
 * camera is invisible to the scene until it leaves this set. Unhealthy is not
 * counted: that resource settled and failed, which `unhealthyResources` reports.
 */
export const reconfiguringResources = (resources: ResourceStatus[] = []): ReconfiguringResource[] =>
	resources.flatMap(({ name, state }) => {
		const label = stateLabel(state)
		return label === undefined ? [] : [{ name: name?.name ?? 'unknown resource', state: label }]
	})
