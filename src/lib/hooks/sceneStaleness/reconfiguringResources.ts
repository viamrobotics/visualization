import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'

/**
 * What rdk names every default service, one per subtype, so a machine reports
 * several resources sharing this short name. `resource.DefaultServiceName`.
 */
const DEFAULT_SERVICE_NAME = 'builtin'

const SERVICE_TYPE = 'service'

/** A resource the machine has started applying a config to but not finished. */
export interface ReconfiguringResource {
	/**
	 * Unique across the machine, unlike the short name. Only an identity for
	 * keying a list, never shown.
	 */
	key: string

	/** What to call the resource in the tooltip. */
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
 * The subtype carries the meaning for a default service, whose own name is
 * `builtin` on every one of them. `motion` and `sensors` tell the user which
 * service is configuring where two rows reading `builtin` would not. Gated on
 * the type, since nothing stops a user naming a component `builtin` and its
 * subtype would match nothing in their config.
 */
const displayName = ({
	type,
	subtype,
	name,
}: {
	type: string
	subtype: string
	name: string
}): string => (type === SERVICE_TYPE && name === DEFAULT_SERVICE_NAME ? subtype : name)

/**
 * Resources the machine has not finished settling.
 *
 * A component joins the frame system only once it configures, so a newly added
 * camera is invisible to the scene until it leaves this set. Unhealthy is not
 * counted: that resource settled and failed, which `unhealthyResources` reports.
 *
 * What survives is everything that holds up the machine, which is wider than
 * what the scene draws, since a service reconfiguring is part of the same wait.
 *
 * @param resources From `useResourceStatuses`, which has already dropped what
 *   rdk does not count as a configured resource.
 */
export const reconfiguringResources = (
	resources: readonly ResourceStatus[] = []
): ReconfiguringResource[] =>
	resources.flatMap(({ name, state }) => {
		if (name === undefined) {
			return []
		}

		const label = stateLabel(state)
		if (label === undefined) {
			return []
		}

		return [
			{
				key: `${name.namespace}:${name.type}:${name.subtype}:${name.name}`,
				name: displayName(name),
				state: label,
			},
		]
	})
