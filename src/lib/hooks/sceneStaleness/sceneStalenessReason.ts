import type { PendingInstall } from './pendingInstalls'
import type { ReconfiguringResource } from './reconfiguringResources'

/** Why the scene is not yet drawing the machine's current configuration. */
export type SceneStalenessReason =
	| 'awaiting-config'
	| 'installing'
	| 'reconfiguring'
	| 'scene-behind'
	| 'starting'

export interface SceneFreshness {
	/** A machine that cannot be reached is not mid-update, it is absent. */
	isConnected: boolean

	/** The machine reports itself as still initializing. */
	isMachineStarting: boolean

	/** A config committed in this session that the machine has not ingested yet. */
	isAwaitingSavedConfig: boolean

	/** The frame system was last fetched under an older config revision than the machine now reports. */
	isSceneBehindConfig: boolean

	installing: readonly PendingInstall[]
	reconfiguring: readonly ReconfiguringResource[]
}

/**
 * The most specific reason the scene is behind, or undefined when it is current.
 *
 * Ordered by how much each explains rather than by how the update progresses. A
 * named module download tells the user more about the wait than "the machine
 * was reconfigured" does, so it wins whenever both hold.
 */
export const sceneStalenessReason = (
	freshness: SceneFreshness
): SceneStalenessReason | undefined => {
	if (!freshness.isConnected) {
		return undefined
	}

	if (freshness.installing.length > 0) {
		return 'installing'
	}

	if (freshness.reconfiguring.length > 0) {
		return 'reconfiguring'
	}

	if (freshness.isMachineStarting) {
		return 'starting'
	}

	if (freshness.isAwaitingSavedConfig) {
		return 'awaiting-config'
	}

	return freshness.isSceneBehindConfig ? 'scene-behind' : undefined
}
