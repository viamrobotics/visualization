import { useThrelte } from '@threlte/core'
import { onDestroy } from 'svelte'

import type { Transform } from '$lib/buf/common/v1/common_pb'
import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'

import { useWorld } from '$lib/ecs'

import type { IKStatus } from './parse-ik-solutions'

import { type ParsedPlan, parsePlan } from '../parse-plan'
import { parsedPlanToSnapshots } from '../plan-to-snapshots'
import {
	applySnapshot,
	createDrawnSet,
	destroyDrawnSet,
	type DrawnSet,
	drawObstacles,
	drawPoseSet,
	setDrawnSetVisible,
} from './draw-pose-set'
import {
	countByStatus,
	filterByStatus,
	groupBySeed,
	type IKCandidate,
	type IKSeedBucket,
	type IKStatusCounts,
	sortByCost,
	toCandidates,
} from './ik-candidates'
import { inspectIK } from './inspect-ik-client'
import {
	buildInterpolatedPath,
	DEFAULT_PATH_STEPS,
	MAX_PATH_STEPS,
	MIN_PATH_STEPS,
} from './interpolate-configuration'
import { namespaceSnapshot } from './namespace-snapshot'
import {
	PATH_STYLE,
	type PoseKind,
	type PoseSet,
	poseSetsForCandidate,
	PREFIX,
	supportsInterpolation,
} from './pose-sets'
import { worldStateObstacleTransforms } from './world-state-obstacles'

export type IKSortMode = 'seed' | 'cost'
export type IKInspectionStatus = 'idle' | 'loading' | 'ready' | 'error'

const ALL_STATUSES: IKStatus[] = ['valid', 'path-invalid', 'invalid']

const allVisible = (): Record<PoseKind, boolean> => ({
	start: true,
	lastGood: true,
	end: true,
	path: true,
})

/**
 * `parsePlan` drops everything but the frame system, and this mockup deliberately does not widen
 * it — see viam-kb `visualization/local-viz-motion-plan-parsing-improvements.md` §3. The request is
 * a single JSON object, so the two fields the panel needs are one parse away.
 */
const readRequestExtras = (
	content: string
): { startConfiguration: Record<string, number[]>; worldState: unknown } => {
	try {
		const raw = JSON.parse(content) as {
			start_state?: { configuration?: Record<string, number[]> }
			world_state?: unknown
		}
		return {
			startConfiguration: raw.start_state?.configuration ?? {},
			worldState: raw.world_state,
		}
	} catch {
		return { startConfiguration: {}, worldState: undefined }
	}
}

export interface IKInspectionContext {
	/** Whether the replayer panel is currently handed over to IK inspection. */
	readonly isActive: boolean
	readonly status: IKInspectionStatus
	readonly error: string | null
	readonly planName: string | null
	readonly candidates: IKCandidate[]
	readonly counts: IKStatusCounts
	readonly totalCount: number
	readonly statusFilter: ReadonlySet<IKStatus>
	readonly sortMode: IKSortMode
	readonly visibleCandidates: IKCandidate[]
	readonly seedBuckets: IKSeedBucket[]
	readonly expandedSeeds: ReadonlySet<number>
	readonly selectedCandidate: IKCandidate | undefined
	readonly poseSets: PoseSet[]
	readonly poseVisibility: Record<PoseKind, boolean>
	/** Requested interpolation resolution; the built path can be one longer once last-good splices in. */
	readonly pathSteps: number
	readonly pathStep: number
	/** 0 when the selected candidate has no interpolatable path. */
	readonly pathLength: number
	readonly lastGoodStepIndex: number | null
	inspect: (planName: string, planContent: string) => Promise<void>
	exit: () => void
	select: (id: string | null) => void
	toggleStatusFilter: (status: IKStatus) => void
	resetStatusFilter: () => void
	setSortMode: (mode: IKSortMode) => void
	toggleSeed: (seedIndex: number) => void
	setPoseVisible: (kind: PoseKind, visible: boolean) => void
	setPathSteps: (steps: number) => void
	setPathStep: (index: number) => void
	clear: () => void
}

// One inspection panel per app, so the context is published to a module-level variable like the
// replayer's own hook rather than through Svelte context.
let context: IKInspectionContext | undefined

export const provideIKInspection = (): IKInspectionContext => {
	const world = useWorld()
	const { invalidate } = useThrelte()

	// Proto objects and ECS handles live outside $state — a Svelte 5 deep proxy over a Snapshot or
	// a 130-element candidate list is pure overhead, and koota entities must not be proxied.
	let parsedRequest: ParsedPlan | undefined
	let startConfiguration: Record<string, number[]> = {}
	let obstacleTransforms: Transform[] = []
	const drawnSets = new Map<PoseKind, DrawnSet>()
	let drawnObstacles: DrawnSet | undefined
	let pathSnapshots: Snapshot[] = []

	let isActive = $state(false)
	let status = $state<IKInspectionStatus>('idle')
	let error = $state<string | null>(null)
	let planName = $state<string | null>(null)
	let selectedId = $state<string | null>(null)
	let sortMode = $state<IKSortMode>('seed')
	let poseVisibility = $state<Record<PoseKind, boolean>>(allVisible())
	let pathSteps = $state(DEFAULT_PATH_STEPS)
	let pathStep = $state(0)
	let pathLength = $state(0)
	let lastGoodStepIndex = $state<number | null>(null)
	let candidates = $state.raw<IKCandidate[]>([])
	let statusFilter = $state.raw<ReadonlySet<IKStatus>>(new Set(ALL_STATUSES))
	let expandedSeeds = $state.raw<ReadonlySet<number>>(new Set([0]))

	const counts = $derived(countByStatus(candidates))
	const filtered = $derived(filterByStatus(candidates, statusFilter))
	const visibleCandidates = $derived(sortMode === 'cost' ? sortByCost(filtered) : filtered)
	const seedBuckets = $derived(groupBySeed(visibleCandidates))
	const selectedCandidate = $derived(candidates.find((candidate) => candidate.id === selectedId))
	const poseSets = $derived(
		selectedCandidate ? poseSetsForCandidate(selectedCandidate, startConfiguration) : []
	)

	const clearPath = () => {
		const drawn = drawnSets.get('path')
		if (drawn) destroyDrawnSet(drawn)
		drawnSets.delete('path')
		pathSnapshots = []
		pathLength = 0
		pathStep = 0
		lastGoodStepIndex = null
	}

	const clearPoseSets = () => {
		clearPath()
		for (const drawn of drawnSets.values()) destroyDrawnSet(drawn)
		drawnSets.clear()
	}

	const applyPathStep = (index: number) => {
		const drawn = drawnSets.get('path')
		const snapshot = pathSnapshots[index]
		if (!drawn || !snapshot) return

		applySnapshot(world, drawn, snapshot, PATH_STYLE)
		pathStep = index
	}

	/**
	 * Rebuilds the scrubbable straight-line path for a candidate. Called on selection and whenever
	 * the resolution changes; the static pose ghosts are left alone either way.
	 */
	const rebuildPath = (candidate: IKCandidate | undefined) => {
		// A resolution change should leave the user roughly where they were looking, so position is
		// held as a fraction rather than an index. A candidate change arrives via drawSelection,
		// which has already cleared the path — so this reads 0 there and the new path starts at its
		// beginning.
		const heldFraction = pathLength > 1 ? pathStep / (pathLength - 1) : 0
		clearPath()

		const end = candidate?.solution.configuration
		if (!candidate || !end || !parsedRequest) return
		if (!supportsInterpolation(candidate, startConfiguration)) return

		const path = buildInterpolatedPath(
			startConfiguration,
			end,
			pathSteps,
			candidate.solution.lastGoodInputs
		)

		pathSnapshots = parsedPlanToSnapshots({
			...parsedRequest,
			trajectory: path.map((step) => step.configuration),
		}).map((snapshot) => namespaceSnapshot(snapshot, PREFIX.path))

		pathLength = pathSnapshots.length
		const markIndex = path.findIndex((step) => step.isLastGood)
		lastGoodStepIndex = markIndex === -1 ? null : markIndex

		const drawn = createDrawnSet(world, PREFIX.path)
		drawnSets.set('path', drawn)
		setDrawnSetVisible(drawn, poseVisibility.path)
		applyPathStep(Math.round(heldFraction * (pathLength - 1)))
	}

	const teardownScene = () => {
		clearPoseSets()
		if (drawnObstacles) destroyDrawnSet(drawnObstacles)
		drawnObstacles = undefined
		invalidate()
	}

	const ensureObstacles = () => {
		if (drawnObstacles || obstacleTransforms.length === 0) return
		drawnObstacles = drawObstacles(world, obstacleTransforms)
	}

	const drawSelection = () => {
		clearPoseSets()

		const candidate = candidates.find((entry) => entry.id === selectedId)
		if (!candidate || !parsedRequest) {
			invalidate()
			return
		}

		for (const poseSet of poseSetsForCandidate(candidate, startConfiguration)) {
			// One call per pose set, each with a single-step trajectory: a solution's configuration
			// is already exactly the shape of one trajectory step, and a fresh call mints fresh
			// frame uuids so the sets stay independent.
			const [snapshot] = parsedPlanToSnapshots({
				...parsedRequest,
				trajectory: [poseSet.configuration],
			})
			if (!snapshot) continue

			const drawn = drawPoseSet(world, poseSet, snapshot)
			setDrawnSetVisible(drawn, poseVisibility[poseSet.kind])
			drawnSets.set(poseSet.kind, drawn)
		}

		rebuildPath(candidate)
		invalidate()
	}

	const clear = () => {
		teardownScene()
		parsedRequest = undefined
		startConfiguration = {}
		obstacleTransforms = []
		candidates = []
		selectedId = null
		error = null
		status = 'idle'
	}

	const exit = () => {
		clear()
		planName = null
		isActive = false
	}

	const inspect = async (name: string, planContent: string) => {
		clear()
		planName = name
		status = 'loading'
		isActive = true

		try {
			const result = await inspectIK(planContent)

			parsedRequest = parsePlan(result.requestContent)
			const extras = readRequestExtras(result.requestContent)
			startConfiguration = extras.startConfiguration
			obstacleTransforms = worldStateObstacleTransforms(extras.worldState)
			candidates = toCandidates(result.seedGroups)

			ensureObstacles()
			status = 'ready'
			invalidate()
		} catch (error_) {
			console.warn('[InspectIK] inspection failed:', error_)
			error = error_ instanceof Error ? error_.message : 'IK inspection failed.'
			status = 'error'
		}
	}

	context = {
		get isActive() {
			return isActive
		},
		get status() {
			return status
		},
		get error() {
			return error
		},
		get planName() {
			return planName
		},
		get candidates() {
			return candidates
		},
		get counts() {
			return counts
		},
		get totalCount() {
			return candidates.length
		},
		get statusFilter() {
			return statusFilter
		},
		get sortMode() {
			return sortMode
		},
		get visibleCandidates() {
			return visibleCandidates
		},
		get seedBuckets() {
			return seedBuckets
		},
		get expandedSeeds() {
			return expandedSeeds
		},
		get selectedCandidate() {
			return selectedCandidate
		},
		get poseSets() {
			return poseSets
		},
		get poseVisibility() {
			return poseVisibility
		},
		get pathSteps() {
			return pathSteps
		},
		get pathStep() {
			return pathStep
		},
		get pathLength() {
			return pathLength
		},
		get lastGoodStepIndex() {
			return lastGoodStepIndex
		},
		inspect,
		exit,
		select: (id) => {
			selectedId = id
			drawSelection()
		},
		toggleStatusFilter: (value) => {
			const next = new Set(statusFilter)
			if (next.has(value)) next.delete(value)
			else next.add(value)
			statusFilter = next
		},
		resetStatusFilter: () => {
			statusFilter = new Set(ALL_STATUSES)
		},
		setSortMode: (mode) => {
			sortMode = mode
		},
		toggleSeed: (seedIndex) => {
			const next = new Set(expandedSeeds)
			if (next.has(seedIndex)) next.delete(seedIndex)
			else next.add(seedIndex)
			expandedSeeds = next
		},
		setPoseVisible: (kind, visible) => {
			poseVisibility = { ...poseVisibility, [kind]: visible }
			const drawn = drawnSets.get(kind)
			if (drawn) setDrawnSetVisible(drawn, visible)
			invalidate()
		},
		setPathSteps: (steps) => {
			const next = Math.min(MAX_PATH_STEPS, Math.max(MIN_PATH_STEPS, Math.trunc(steps)))
			if (!Number.isFinite(next) || next === pathSteps) return
			pathSteps = next
			rebuildPath(candidates.find((candidate) => candidate.id === selectedId))
			invalidate()
		},
		setPathStep: (index) => {
			applyPathStep(Math.max(0, Math.min(pathLength - 1, index)))
			invalidate()
		},
		clear,
	}

	// Only clear if we still own the singleton
	const instance = context
	onDestroy(() => {
		clear()
		if (context === instance) context = undefined
	})

	return context
}

export const useIKInspection = (): IKInspectionContext => {
	if (context === undefined) {
		throw new Error('useIKInspection must be used with a mounted <MotionPlanReplayer>')
	}

	return context
}
