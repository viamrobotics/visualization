export interface SceneRevisions {
	/**
	 * Whether the user is authoring the scene from the part config rather than
	 * watching the machine's.
	 */
	isBuildMode: boolean

	/**
	 * Whether the last `frameSystemConfig` attempt failed. `createRobotQuery`
	 * sets `retry: false`, so a failure is where the fetch stops.
	 */
	hasFailedFetch: boolean

	/** The config revision current when `frameSystemConfig` last answered. Empty before the first reply. */
	renderedRevision: string

	/** The revision the machine reports having ingested. Empty when it reports none. */
	machineRevision: string
}

/**
 * Whether the scene is drawing frames from a revision the machine has moved off
 * and is about to catch up from.
 *
 * False in build mode. `useFrames` merges config frames over the machine's
 * `frameSystemConfig` reply there, so the scene draws the config the moment it
 * is saved and a revision the machine has not caught up to says nothing about
 * what is on screen. Claiming otherwise leaves the badge up long after the user
 * watched their frame move.
 *
 * False after a failed fetch, which is the harder case to see. The scene really
 * is behind, but `dataUpdatedAt` does not advance on an error and nothing
 * retries, so no refetch is coming and a badge promising one would lie. The
 * failure is reported as a frames error in the logs panel instead.
 */
export const isSceneBehindConfig = ({
	isBuildMode,
	hasFailedFetch,
	renderedRevision,
	machineRevision,
}: SceneRevisions): boolean =>
	!isBuildMode &&
	!hasFailedFetch &&
	renderedRevision !== '' &&
	machineRevision !== '' &&
	renderedRevision !== machineRevision
