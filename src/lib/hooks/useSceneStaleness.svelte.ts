import { MachineConnectionEvent, robotApi } from '@viamrobotics/sdk'
import { useConnectionStatus, useMachineStatus } from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

import { type PendingInstall, pendingInstalls } from './sceneStaleness/pendingInstalls'
import {
	type ReconfiguringResource,
	reconfiguringResources,
} from './sceneStaleness/reconfiguringResources'
import {
	type SceneFreshness,
	sceneStalenessReason,
	type SceneStalenessReason,
} from './sceneStaleness/sceneStalenessReason'
import { sceneStalenessSummary } from './sceneStaleness/sceneStalenessSummary'
import { useFrames } from './useFrames.svelte'
import { usePartConfig } from './usePartConfig.svelte'

/**
 * How long a save may go unacknowledged before the scene stops claiming an
 * update is on the way. A machine powered off between the save and its next
 * config poll never moves its revision, and the indicator would otherwise sit
 * there for the rest of the session.
 */
const SAVE_INGEST_TIMEOUT_MS = 30_000

const key = Symbol('scene-staleness-context')

export interface SceneStalenessContext {
	/** Why the scene is behind the machine's configuration, or undefined when it is current. */
	readonly reason: SceneStalenessReason | undefined

	/** One line naming what the scene is waiting on. Empty while `reason` is undefined. */
	readonly summary: string

	readonly installing: readonly PendingInstall[]
	readonly reconfiguring: readonly ReconfiguringResource[]
}

/**
 * Tracks whether the scene is drawing the configuration the machine is actually
 * running.
 *
 * Saving a config does not redraw anything on its own. The cloud takes the
 * write, the machine picks it up on its next poll, modules download, resources
 * configure, and only then does the frame system carry the new component. The
 * SDK's `MachineWatcher` refetches every robot query once the revision moves, so
 * the scene does catch up by itself, but nothing about a frozen scene says so
 * and the reflex is to reload the page.
 */
export const provideSceneStaleness = (partID: () => string) => {
	const frames = useFrames()
	const partConfig = usePartConfig()
	const machineStatus = useMachineStatus(partID)
	const connectionStatus = useConnectionStatus(partID)

	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)
	const machineRevision = $derived(machineStatus.current?.config?.revision ?? '')

	// `MachineWatcher` polls the status once a second and every reader shares
	// that cache entry, so this is a clock that ticks exactly when there is new
	// information to judge, with no timer of its own.
	const statusAt = $derived(machineStatus.query.dataUpdatedAt)

	let renderedRevision = $state('')
	let lastFetchedAt = 0

	let pendingSave = $state.raw<{ revision: string; at: number } | undefined>()
	let lastSavedSnapshot: string | undefined

	// A part switch invalidates both trackers: the previous machine's revision
	// would otherwise read as this one being behind, and its pending save would
	// be attributed to a machine that never received it.
	$effect(() => {
		partID()

		untrack(() => {
			renderedRevision = ''
			lastFetchedAt = 0
			pendingSave = undefined
			lastSavedSnapshot = undefined
		})
	})

	// Pair the drawn frames with the revision they came from. The watcher
	// invalidates `frameSystemConfig` *because* it saw a new revision, so by the
	// time the refetch resolves the status already carries that revision.
	$effect(() => {
		const fetchedAt = frames.fetchedAt
		if (fetchedAt === 0 || fetchedAt === lastFetchedAt) return

		lastFetchedAt = fetchedAt
		renderedRevision = untrack(() => machineRevision)
	})

	// The window between a save reaching the cloud and the machine reading it is
	// the one part of the wait the machine reports nothing about: it is still
	// running the old config, happily, with every resource ready. Measure it from
	// this side instead, against the revision that was current when the config
	// was committed.
	$effect(() => {
		const snapshot = partConfig.savedSnapshot

		if (!partConfig.isReady) return

		untrack(() => {
			if (lastSavedSnapshot === undefined || snapshot === lastSavedSnapshot) {
				lastSavedSnapshot = snapshot
				return
			}

			lastSavedSnapshot = snapshot
			pendingSave = { revision: machineRevision, at: Date.now() }
		})
	})

	const isAwaitingSavedConfig = $derived.by(() => {
		if (!pendingSave) return false
		if (machineRevision !== '' && machineRevision !== pendingSave.revision) return false

		return statusAt - pendingSave.at < SAVE_INGEST_TIMEOUT_MS
	})

	const isSceneBehindConfig = $derived(
		renderedRevision !== '' && machineRevision !== '' && renderedRevision !== machineRevision
	)

	const installing = $derived(
		pendingInstalls(machineStatus.query.data?.modules, machineStatus.query.data?.packages)
	)
	const reconfiguring = $derived(reconfiguringResources(machineStatus.current?.resources))

	const freshness = $derived<SceneFreshness>({
		isConnected,
		isMachineStarting:
			machineStatus.current?.state === robotApi.GetMachineStatusResponse_State.INITIALIZING,
		isAwaitingSavedConfig,
		isSceneBehindConfig,
		installing,
		reconfiguring,
	})

	const reason = $derived(sceneStalenessReason(freshness))
	const summary = $derived(reason === undefined ? '' : sceneStalenessSummary(reason, freshness))

	setContext<SceneStalenessContext>(key, {
		get reason() {
			return reason
		},
		get summary() {
			return summary
		},
		get installing() {
			return installing
		},
		get reconfiguring() {
			return reconfiguring
		},
	})
}

export const useSceneStaleness = (): SceneStalenessContext => {
	return getContext<SceneStalenessContext>(key)
}
