import { commonApi, MachineConnectionEvent } from '@viamrobotics/sdk'
import { createRobotQuery, useConnectionStatus, useRobotClient } from '@viamrobotics/svelte-sdk'
import { type Entity, Not } from 'koota'
import { getContext, setContext, untrack } from 'svelte'

import { RefetchRates } from '$lib/components/overlay/refetchRates'
import { traits, useParentName, useQuery, useTrait } from '$lib/ecs'
import { originFrameName } from '$lib/kinematicsFrames'
import { Pose } from '$lib/math'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { isPoseStale } from './poseStaleness/isPoseStale'
import { useFrames } from './useFrames.svelte'
import { RefreshRates, useSettings } from './useSettings.svelte'

/** How often the freshness gap is re-measured. */
const FRESHNESS_TICK_MS = 500

const tempPose = new Pose()

const key = Symbol('use-poses-context')

export interface Context {
	/**
	 * True while the scene is drawing poses older than the poll rate can
	 * explain. A frozen frame is indistinguishable from a stationary one, so
	 * nothing else gives the staleness away.
	 */
	readonly isStale: boolean

	/** Refetches the pose of every frame the current part config expects. */
	refetch: () => Promise<PromiseSettledResult<unknown>[]>
}

/**
 * Mirrors each live-machine frame's kinematics-resolved pose into its
 * `LiveMatrix` trait. Watches every entity with `FramesAPI` and drives one
 * `getPose` poll per frame, writing the result so `Frame.svelte` can compose
 * the rendered transform via `composeLocalMatrix(live, baseline, edited)`.
 *
 * A frame carrying `ConfigOnlyFrame` is left out: the machine's frame system
 * has no such frame, so polling it only produces an error every tick and a
 * freshness gap that reads as the whole scene having gone stale.
 *
 * Replaces the former per-entity `<Pose>` wrapper component with a single
 * reactor mounted alongside the other `provide*` hooks. Each frame's query is
 * built in its own `$effect.root` and tracked in a stable map, so adding or
 * removing one frame never tears down the other frames' queries.
 */
export const providePoses = (partID: () => string) => {
	const settings = useSettings()
	const logs = useLogs()
	const robotClient = useRobotClient(partID)
	const connectionStatus = useConnectionStatus(partID)
	const frames = useFrames()

	const frameEntities = useQuery(traits.FramesAPI, Not(traits.ConfigOnlyFrame))

	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)

	const interval = $derived(settings.current.refreshRates[RefreshRates.poses])
	const options = $derived({
		enabled: partID() !== '' && interval !== RefetchRates.OFF && isConnected,
		// The chosen refresh rate is the only thing that polls a pose. Focus is not:
		// `Manual` leaves these queries enabled with no interval, so refetching on
		// focus would fire one request per frame in the scene.
		refetchOnWindowFocus: false,
		refetchInterval: interval === RefetchRates.MANUAL ? (false as const) : interval,
	})

	/** The scene draws one node per component, at its mount, so the query redirects there. */
	const toQueryName = (frameName: string | undefined): string | undefined =>
		frameName !== undefined && frames.kinematicsComponents.has(frameName)
			? originFrameName(frameName)
			: frameName

	/**
	 * Builds one frame's `getPose` query plus the reactive name/parent it reads.
	 * Every hook here (`useTrait`, `useParentName`, `createRobotQuery`) allocates
	 * `$state` and registers `$effect`s / Koota subscriptions, so each entry is
	 * created inside its own `$effect.root` (below) — never inside a `$derived`
	 * over the frame list, which would tear down and re-fetch *every* frame's
	 * query whenever a single frame is added or removed.
	 *
	 * Within a stable entry, name / parent / kinematics reactivity flows through
	 * the query's args closure, so a reparent or a newly-arrived model refetches
	 * without rebuilding anything.
	 */
	const buildEntry = (entity: Entity) => {
		const name = useTrait(() => entity, traits.Name)
		const parentName = useParentName(() => entity)

		/**
		 * The name to ask for this frame's pose by, or `''` once the entity is gone.
		 *
		 * A destroyed entity has no `Name`, and this entry outlives it by a flush,
		 * so the empty case is how the query learns its frame no longer exists.
		 * `entity.isAlive()` would read better here but is not reactive, so it would
		 * never recompute. rdk rejects a nameless pose request outright.
		 */
		const queryName = $derived(toQueryName(name.current) ?? '')

		const query = createRobotQuery(
			robotClient,
			'getPose',
			() => {
				// Parent too: measured from a parent arm's tip, children would mount at
				// the wrong end of the arm.
				return [queryName, toQueryName(parentName.current) ?? 'world', []] as [
					string,
					string,
					commonApi.Transform[],
				]
			},
			() => ({ ...options, enabled: options.enabled && queryName !== '' })
		)

		return { entity, name, query }
	}

	type PoseEntry = ReturnType<typeof buildEntry> & { dispose: () => void; joinedAt: number }

	const entryByEntity = new Map<Entity, PoseEntry>()
	let entries = $state.raw<PoseEntry[]>([])

	/**
	 * Reconcile the query map against the live frame set: a newly-added frame
	 * gets a fresh `$effect.root`, a departed one is disposed, and a tick that
	 * doesn't change membership is a no-op. `entries` is only reassigned when
	 * the set actually changes, so stable frames keep their query instances.
	 */
	$effect(() => {
		const present = new Set(frameEntities.current)
		let changed = false

		for (const entity of frameEntities.current) {
			if (entryByEntity.has(entity)) continue

			let built!: ReturnType<typeof buildEntry>
			const dispose = $effect.root(() => {
				built = buildEntry(entity)
			})
			entryByEntity.set(entity, { ...built, dispose, joinedAt: Date.now() })
			changed = true
		}

		for (const [entity, entry] of entryByEntity) {
			if (present.has(entity)) continue
			entry.dispose()
			entryByEntity.delete(entity)
			changed = true
		}

		if (changed) {
			entries = [...entryByEntity.values()]
		}
	})

	// Dispose every entry's root when the provider unmounts. Reads nothing
	// reactive, so it runs once and only its teardown fires — the reconcile
	// effect above must not dispose on its per-run cleanup.
	$effect(() => () => {
		for (const entry of entryByEntity.values()) entry.dispose()
		entryByEntity.clear()
	})

	// Only the per-frame "Fetching..." notices collapse to one summary at a live
	// rate. Errors are always reported per frame: they are what marks the frame's
	// row in the world tree, and repeats collapse into a single counted line.
	const isLiveRate = $derived(interval === RefetchRates.FPS_30 || interval === RefetchRates.FPS_60)

	$effect(() => {
		if (isLiveRate) {
			logs.add(`Fetching poses every ${interval}ms...`, 'info', { folder: 'frames' })
		}

		for (const { name, query } of entries) {
			untrack(() => {
				$effect(() => {
					if (query.error) {
						logs.add(`Error fetching pose for ${name.current}: ${query.error.message}`, 'error', {
							resource: name.current,
							folder: 'frames',
						})
					} else if (query.isFetching && !isLiveRate) {
						logs.add(`Fetching pose for ${name.current}...`, 'info', {
							resource: name.current,
							folder: 'frames',
						})
					}
				})
			})
		}
	})

	/**
	 * Mirror each resolved pose into `LiveMatrix`. One nested effect per frame
	 * so a single pose update only rewrites that frame's matrix — and only its
	 * subtree re-composes in `provideWorldMatrix` — rather than every frame's.
	 * The write signals `entity.changed(LiveMatrix)`, which drives the
	 * microtask-deferred WorldMatrix walk, so a plain `$effect` suffices (same
	 * as the `Matrix` write in `provideGeometries`).
	 */
	$effect(() => {
		for (const { entity, query } of entries) {
			untrack(() => {
				$effect(() => {
					const pose = query.data?.pose
					if (!pose || !entity.isAlive()) return

					const live = entity.get(traits.LiveMatrix)
					if (live) {
						tempPose.copy(pose).toMatrix4(live)

						entity.changed(traits.LiveMatrix)
					} else {
						entity.add(traits.LiveMatrix(tempPose.copy(pose).toMatrix4()))
					}
				})
			})
		}
	})

	const expectedFrameNames = () => frames.current.map(({ referenceFrame }) => referenceFrame)

	let now = $state(0)
	let pollingStartedAt = $state(0)

	// A stalled scene emits no reactive updates of its own, so the gap has to be
	// re-measured against a clock. Restarts on the part it is measuring, so one
	// machine's gap is never carried into the next.
	$effect(() => {
		partID()

		if (!options.enabled) return

		pollingStartedAt = now = Date.now()

		const id = setInterval(() => {
			now = Date.now()
		}, FRESHNESS_TICK_MS)

		return () => clearInterval(id)
	})

	const polledFrames = $derived(
		entries.map(({ query, joinedAt }) => ({ lastPoseAt: query.dataUpdatedAt, joinedAt }))
	)

	// A paused scene is deliberately showing a snapshot, not a broken one.
	const isStale = $derived(
		options.enabled && isPoseStale({ now, pollingStartedAt, interval, frames: polledFrames })
	)

	setContext<Context>(key, {
		get isStale() {
			return isStale
		},
		refetch: () => {
			const expected = new Set(expectedFrameNames())
			const currentEntries = entries.filter(
				({ name }) => name.current !== undefined && expected.has(name.current)
			)
			return Promise.allSettled(currentEntries.map(({ query }) => query.refetch()))
		},
	})
}

export const usePoses = () => {
	return getContext<Context>(key)
}
