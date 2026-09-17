import { MachineConnectionEvent, robotApi } from '@viamrobotics/sdk'
import { useConnectionStatus, useMachineStatus } from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

import { isSceneBehindConfig } from './sceneStaleness/isSceneBehindConfig'
import { type PendingInstall, pendingInstalls } from './sceneStaleness/pendingInstalls'
import {
	type ReconfiguringResource,
	reconfiguringResources,
} from './sceneStaleness/reconfiguringResources'
import { sceneStalenessMessage } from './sceneStaleness/sceneStalenessMessage'
import {
	type SceneFreshness,
	sceneStalenessReason,
	type SceneStalenessReason,
} from './sceneStaleness/sceneStalenessReason'
import { useEnvironment } from './useEnvironment.svelte'
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
	/** What the machine is still working through, or undefined when it has settled. */
	readonly reason: SceneStalenessReason | undefined

	/** Badge text. Empty while `reason` is undefined. */
	readonly label: string

	/** One line naming what is happening. Empty while `reason` is undefined. */
	readonly summary: string

	readonly installing: readonly PendingInstall[]
	readonly reconfiguring: readonly ReconfiguringResource[]
}

/**
 * Tracks what the machine is still doing with a configuration the user saved.
 *
 * Saving does not apply anything on its own. The cloud takes the write, the
 * machine re-reads its config on an interval that defaults to ten seconds,
 * modules download, resources configure, and only then does the frame system
 * carry the new component. The SDK's `MachineWatcher` refetches every robot
 * query once the revision moves, so the scene does catch up by itself, but
 * nothing about a frozen scene says so and the reflex is to reload the page.
 *
 * Only `scene-behind` is a claim about what is drawn. In build mode the scene
 * renders the part config directly, so the saved change is on screen before the
 * machine has touched it and that reason is withheld.
 */
export const provideSceneStaleness = (partID: () => string) => {
	const environment = useEnvironment()
	const frames = useFrames()
	const partConfig = usePartConfig()
	const machineStatus = useMachineStatus(partID)
	const connectionStatus = useConnectionStatus(partID)

	// `query.data` rather than `machineStatus.current`, whose type carries neither
	// `modules` nor `packages`. Everything below comes off one response instead of
	// two views of it that could be read as disagreeing.
	const status = $derived(machineStatus.query.data)

	const isBuildMode = $derived(environment.current.mode === 'build')
	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)
	const machineRevision = $derived(status?.config?.revision ?? '')

	let renderedRevision = $state('')
	let lastFetchedAt = 0

	let pendingSave = $state.raw<{ revision: string } | undefined>()
	let lastSaveCount: number | undefined

	// A part switch invalidates both trackers: the previous machine's revision
	// would otherwise read as this one being behind, and its pending save would
	// be attributed to a machine that never received it.
	$effect(() => {
		partID()

		untrack(() => {
			renderedRevision = ''
			lastFetchedAt = 0
			pendingSave = undefined
			lastSaveCount = undefined
		})
	})

	// Pair the drawn frames with the revision they came from. The watcher
	// invalidates `frameSystemConfig` *because* it saw a new revision, so by the
	// time a refetch resolves the status already carries that revision.
	//
	// The very first reply can beat the first machine status, though, and pairing
	// it with an empty revision would leave the scene permanently unjudgeable:
	// nothing refetches the frames again until the next reconfigure. So the
	// revision is a dependency rather than an untracked read, and an empty one
	// leaves `lastFetchedAt` alone for this run to retry once the status lands.
	$effect(() => {
		const fetchedAt = frames.fetchedAt
		const revision = machineRevision

		if (fetchedAt === 0 || revision === '' || fetchedAt === lastFetchedAt) return

		lastFetchedAt = fetchedAt
		renderedRevision = revision
	})

	// The window between a save reaching the cloud and the machine reading it is
	// the one part of the wait the machine reports nothing about: it is still
	// running the old config, happily, with every resource ready. Measure it from
	// this side instead, against the revision that was current when the edit was
	// saved.
	$effect(() => {
		const count = partConfig.saveCount

		if (!partConfig.isReady) return

		untrack(() => {
			if (lastSaveCount === undefined || count === lastSaveCount) {
				lastSaveCount = count
				return
			}

			lastSaveCount = count

			// An empty revision is either a status that has not arrived yet or a
			// config the machine has no revision for, such as one read from a local
			// file. Both leave nothing to detect the ingest against, so the save
			// goes untracked rather than tracked against a value that cannot move.
			pendingSave = machineRevision === '' ? undefined : { revision: machineRevision }
		})
	})

	// Give up on a save the machine never acknowledges. A revision that has
	// stopped moving is indistinguishable from one that is about to, and an
	// indicator that waits forever is the confusion it was added to remove.
	$effect(() => {
		if (!pendingSave) return

		const id = setTimeout(() => {
			pendingSave = undefined
		}, SAVE_INGEST_TIMEOUT_MS)

		return () => clearTimeout(id)
	})

	const isAwaitingSavedConfig = $derived(
		pendingSave !== undefined && machineRevision === pendingSave.revision
	)

	const sceneIsBehind = $derived(
		isSceneBehindConfig({
			isBuildMode,
			hasFailedFetch: frames.hasFailedFetch,
			renderedRevision,
			machineRevision,
		})
	)

	const installing = $derived(pendingInstalls(status?.modules, status?.packages))
	const reconfiguring = $derived(reconfiguringResources(status?.resources))

	const freshness = $derived<SceneFreshness>({
		isConnected,
		isMachineStarting: status?.state === robotApi.GetMachineStatusResponse_State.INITIALIZING,
		isAwaitingSavedConfig,
		isSceneBehindConfig: sceneIsBehind,
		installing,
		reconfiguring,
	})

	const reason = $derived(sceneStalenessReason(freshness))
	const message = $derived(
		reason === undefined ? undefined : sceneStalenessMessage(reason, freshness)
	)

	setContext<SceneStalenessContext>(key, {
		get reason() {
			return reason
		},
		get label() {
			return message?.label ?? ''
		},
		get summary() {
			return message?.summary ?? ''
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
