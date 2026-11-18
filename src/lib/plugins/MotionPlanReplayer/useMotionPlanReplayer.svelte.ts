import type { Entity } from 'koota'

import { onDestroy } from 'svelte'

import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import type { TrajectoryPlayer } from '$lib/motion/trajectoryPlayer.svelte'

import { setOrAddTrait, traits, useWorld } from '$lib/ecs'
import { useRelationships } from '$lib/hooks/useRelationships.svelte'
import { createTrajectoryPlayer } from '$lib/motion/trajectoryPlayer.svelte'
import { reconcileSnapshotEntities, type SnapshotEntity } from '$lib/snapshot'

import { parsePlan, PlanParseError } from './parse-plan'
import { parsedPlanToSnapshots } from './plan-to-snapshots'
import * as planRelations from './relations'

const PLAN_COLOR = { r: 0, g: 0.47, b: 1 }
const PLAN_OPACITY = 0.6

export interface PlanEntry {
	name: string
	content: string
}

// Only primitives here — proto objects (Snapshot[]) live outside $state to avoid Svelte 5 deep proxy
interface PlanState {
	/** Survives the reindexing `removePlan` does to `plans`, which a position does not. */
	id: number
	name: string
	content: string
	status: 'idle' | 'ready' | 'error' | 'no-trajectory'
	error: string | null
	stepCount: number
}

export interface MotionPlanReplayerContext {
	readonly plans: PlanState[]
	readonly activePlanIndex: number | null
	readonly currentStep: number
	readonly totalSteps: number
	/** Playback state, shared with `TrajectoryScrubber`. */
	readonly player: TrajectoryPlayer
	addPlan: (name: string, content: string, precomputedSnapshots?: Snapshot[]) => void
	removePlan: (index: number) => void
	selectPlan: (index: number) => void
	setStep: (step: number) => void
	clearActivePlan: () => void
}

// One replayer per app, so we publish the context to a module-level variable like the Logs
// plugin instead of Svelte context.
let context: MotionPlanReplayerContext | undefined

export const provideMotionPlanReplayer = (initialPlans?: PlanEntry[]) => {
	const world = useWorld()
	const relationships = useRelationships()

	// Keyed by `PlanState.id`, not by position in `plans`.
	const snapshotStore = new Map<number, Snapshot[]>()

	let nextPlanId = 0

	let plans = $state<PlanState[]>(
		(initialPlans ?? []).map((e) => ({
			id: nextPlanId++,
			name: e.name,
			content: e.content,
			status: 'idle' as const,
			error: null,
			stepCount: 0,
		}))
	)
	let activePlanIndex = $state<number | null>(null)
	let entityMap = $state.raw(new Map<string, SnapshotEntity>())
	let planEntity: Entity | undefined

	const totalSteps = $derived(
		activePlanIndex === null ? 0 : (plans[activePlanIndex]?.stepCount ?? 0)
	)

	const player = createTrajectoryPlayer({
		totalSteps: () => totalSteps,
		onStep: (step) => {
			if (activePlanIndex === null) return false
			const active = plans[activePlanIndex]
			const snapshots = active && snapshotStore.get(active.id)
			if (!snapshots || snapshots.length === 0) return false
			return applyStep(snapshots, step)
		},
	})

	const clearActivePlan = () => {
		if (planEntity && world.has(planEntity)) planEntity.destroy()
		planEntity = undefined
		entityMap = new Map()
		player.reset()
		activePlanIndex = null
	}

	/** Reports whether the step was drawn; see `TrajectoryPlayerOptions.onStep`. */
	const applyStep = (snapshots: Snapshot[], step: number): boolean => {
		// The player clamps against `stepCount`, written from this same array, so a miss means the two
		// came apart. Reconciling `undefined` would throw out of whatever input handler got here.
		const snap = snapshots[step]
		if (!snap) return false

		// reconcile resets Opacity and removes Invisible/ShowAxesHelper every step, so capture
		// PLAN_OPACITY and the ghost's visibility first. Iterate PartOfPlan so sub-entities are
		// covered too. The user's own opacity edit needs no capture: it lives in
		// `OpacityOverride`, which no reconciler writes.
		const preserved = new Map<
			Entity,
			{ opacity: number | undefined; invisible: boolean; showAxes: boolean }
		>()
		if (planEntity) {
			for (const entity of world.query(planRelations.PartOfPlan(planEntity))) {
				preserved.set(entity, {
					opacity: entity.get(traits.Opacity),
					invisible: entity.has(traits.Invisible),
					showAxes: entity.has(traits.ShowAxesHelper),
				})
			}
		}

		const result = reconcileSnapshotEntities(world, snap, entityMap)

		// Plans emit transforms only, and a transform spawns exactly one childless entity, so
		// tagging the spawned set tags every entity the plan owns.
		for (const spawned of result.spawned) {
			relationships.apply(spawned.entity, spawned.relationships)
			const uuid = spawned.entity.get(traits.UUID)
			if (uuid) relationships.flush(uuid)
			if (planEntity) spawned.entity.add(planRelations.PartOfPlan(planEntity))

			// Defaults land on first appearance only. Re-forcing them every step is what wiped
			// the user's Details-panel edits.
			if (!spawned.entity.has(traits.ReferenceFrame))
				setOrAddTrait(spawned.entity, traits.Color, PLAN_COLOR)
			setOrAddTrait(spawned.entity, traits.Opacity, PLAN_OPACITY)
		}

		for (const [entity, prev] of preserved) {
			if (!entity.isAlive()) continue
			if (prev.opacity !== undefined) setOrAddTrait(entity, traits.Opacity, prev.opacity)
			if (prev.invisible) entity.add(traits.Invisible)
			else entity.remove(traits.Invisible)
			if (prev.showAxes) entity.add(traits.ShowAxesHelper)
			else entity.remove(traits.ShowAxesHelper)
		}

		entityMap = result.current
		return true
	}

	/**
	 * For callers that scrub without a scrubber. Clamps, and also pauses: scrubbing by hand while
	 * playback runs would fight it for the next frame.
	 */
	const setStep = (step: number) => player.seek(step)

	const loadPlan = (index: number): void => {
		const planState = plans[index]
		if (!planState) return

		const stored = snapshotStore.get(planState.id)
		if (stored) {
			activePlanIndex = index
			// Rewind without notifying: step 0 is rendered directly below, and letting the player call
			// back into `onStep` here would apply it twice.
			player.reset()
			if (!planEntity) planEntity = world.spawn(traits.Name(planState.name))
			applyStep(stored, 0)
			return
		}

		try {
			const plan = parsePlan(planState.content)
			const snapshots = parsedPlanToSnapshots(plan)
			if (snapshots.length === 0) {
				plans[index] = { ...planState, status: 'no-trajectory', stepCount: 0 }
				activePlanIndex = index
				return
			}
			snapshotStore.set(planState.id, snapshots)
			plans[index] = { ...planState, status: 'ready', stepCount: snapshots.length, error: null }
			activePlanIndex = index
			player.reset()
			if (!planEntity) planEntity = world.spawn(traits.Name(planState.name))
			applyStep(snapshots, 0)
		} catch (error) {
			const msg = error instanceof PlanParseError ? error.message : 'Failed to parse plan.'
			// The error rather than the message: a `PlanParseError` carries what actually failed as
			// `cause`, which the string drops.
			console.warn('[MotionPlanReplayer] loadPlan error:', error)
			plans[index] = { ...planState, status: 'error', error: msg }
		}
	}

	const selectPlan = (index: number): void => {
		if (activePlanIndex !== null && activePlanIndex !== index) clearActivePlan()
		loadPlan(index)
	}

	const addPlan = (name: string, content: string, precomputedSnapshots?: Snapshot[]) => {
		const id = nextPlanId++
		const index = plans.length
		if (precomputedSnapshots && precomputedSnapshots.length > 0) {
			snapshotStore.set(id, precomputedSnapshots)
		}
		plans = [
			...plans,
			{
				id,
				name,
				content,
				status: precomputedSnapshots && precomputedSnapshots.length > 0 ? 'ready' : 'idle',
				error: null,
				stepCount: precomputedSnapshots?.length ?? 0,
			},
		]
		selectPlan(index)
	}

	const removePlan = (index: number) => {
		const removed = plans[index]
		if (!removed) return

		if (activePlanIndex === index) clearActivePlan()
		snapshotStore.delete(removed.id)
		plans = plans.filter((_, i) => i !== index)
		if (activePlanIndex !== null && activePlanIndex > index) {
			activePlanIndex = activePlanIndex - 1
		}
	}

	context = {
		get plans() {
			return plans
		},
		get activePlanIndex() {
			return activePlanIndex
		},
		get currentStep() {
			return player.currentStep
		},
		get totalSteps() {
			return totalSteps
		},
		get player() {
			return player
		},
		addPlan,
		removePlan,
		selectPlan,
		setStep,
		clearActivePlan,
	}

	// Only clear if we still own the singleton
	const instance = context
	onDestroy(() => {
		if (context === instance) context = undefined
	})

	return context
}

export const useMotionPlanReplayer = (): MotionPlanReplayerContext => {
	if (context === undefined) {
		throw new Error('useMotionPlanReplayer must be used with a mounted <MotionPlanReplayer>')
	}

	return context
}
