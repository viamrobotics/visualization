import type { commonApi } from '@viamrobotics/sdk'

import { robotApi } from '@viamrobotics/sdk'

/**
 * viam-server's own plumbing, and the entry standing for a whole remote machine
 * rather than a resource on it. rdk excludes both wherever it reports configured
 * resources, and neither draws anything in the scene.
 */
const INTERNAL_NAMESPACE = 'rdk-internal'
const REMOTE_TYPE = 'remote'

/**
 * What rdk names every default service, one per subtype, so a machine reports
 * several resources sharing this short name. `resource.DefaultServiceName`.
 */
const DEFAULT_SERVICE_NAME = 'builtin'

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
 * service is configuring where two rows reading `builtin` would not.
 */
const displayName = ({ subtype, name }: commonApi.ResourceName): string =>
	name === DEFAULT_SERVICE_NAME ? subtype : name

/**
 * Resources the machine has not finished settling.
 *
 * A component joins the frame system only once it configures, so a newly added
 * camera is invisible to the scene until it leaves this set. Unhealthy is not
 * counted: that resource settled and failed, which `unhealthyResources` reports.
 *
 * Takes the whole machine status rather than the SDK's configured-resource view,
 * because a resource that goes unconfigured leaves `resourceNames` entirely and
 * a list that drops what it is waiting on cannot report the wait. The two
 * categories rdk never counts are filtered here instead. What survives is
 * everything that holds up the machine, which is wider than what the scene
 * draws: a service reconfiguring is part of the same wait.
 */
export const reconfiguringResources = (
	resources: robotApi.ResourceStatus[] = []
): ReconfiguringResource[] =>
	resources.flatMap(({ name, state }) => {
		if (name === undefined || name.namespace === INTERNAL_NAMESPACE || name.type === REMOTE_TYPE) {
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
