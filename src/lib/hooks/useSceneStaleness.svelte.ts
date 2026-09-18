import { MachineConnectionEvent, robotApi } from '@viamrobotics/sdk'
import {
	useConnectionStatus,
	useMachineStatus,
	useResourceStatuses,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

import { unhealthyResources } from './poseStaleness/unhealthyResources'
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

	/**
	 * Whether this badge already accounts for the scene's poses having stopped,
	 * so a second badge saying so would name the symptom beside its cause.
	 */
	readonly explainsStalePoses: boolean

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

	const resourceStatuses = useResourceStatuses(partID)

	// `modules`, `packages`, `config` and `state` only, since `useResourceStatuses`
	// is not typed to carry them. Resources come from there instead.
	const status = $derived(machineStatus.query.data)

	const isBuildMode = $derived(environment.current.mode === 'build')
	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)
	const machineRevision = $derived(status?.config?.revision ?? '')

	let renderedRevision = $state('')

	let pendingSave = $state.raw<{ revision: string } | undefined>()
	let lastSaveCount = 0

	// A part switch invalidates both trackers: the previous machine's revision
	// would otherwise read as this one being behind, and its pending save would
	// be attributed to a machine that never received it. `saveCount` is a session
	// total rather than a per-part one, so it is re-baselined instead of cleared.
	// Clearing it would make the next save look like the first one seen and go
	// untracked, which on the embedded path nothing would ever correct.
	$effect(() => {
		partID()

		untrack(() => {
			renderedRevision = ''
			pendingSave = undefined
			lastSaveCount = partConfig.saveCount
		})
	})

	// Pair the drawn frames with the revision they came from, whenever the frames
	// query is settled. A settled query means what is on screen is the newest the
	// machine has served, so the revision it now reports is the one those frames
	// came from.
	//
	// Re-paired rather than consumed once per fetch. A refetch can resolve before
	// the status catches up to a revision the machine has already moved to, and a
	// pairing locked in at that moment would hold the scene behind for the rest of
	// the session, since nothing refetches the frames again until the next
	// reconfigure. A fetch in flight keeps the pairing that describes the frames
	// still on screen, and a failed one keeps it too, since those frames are the
	// ones still drawn.
	$effect(() => {
		const revision = machineRevision

		if (frames.fetchedAt === 0 || revision === '') return
		if (frames.isFetching || frames.hasFailedFetch) return

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
			if (count === lastSaveCount) return

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
	const reconfiguring = $derived(reconfiguringResources(resourceStatuses.current))

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

	// An unhealthy resource is deliberately absent from `reconfiguring`, so this
	// badge says nothing about it while the pose badge names it and its error.
	// That is the one case where both belong on screen, and it is what bounds the
	// suppression: a resource parked in `CONFIGURING` indefinitely would otherwise
	// hide a genuine pose stall for the rest of the session.
	const explainsStalePoses = $derived(
		reason !== undefined && unhealthyResources(resourceStatuses.current).length === 0
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
		get explainsStalePoses() {
			return explainsStalePoses
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
