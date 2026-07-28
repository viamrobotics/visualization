import { useThrelte } from '@threlte/core'
import { onDestroy } from 'svelte'

import type { Transform } from '$lib/buf/common/v1/common_pb'

import { useWorld } from '$lib/ecs'

import type { IKStatus } from './parse-ik-solutions'

import { type ParsedPlan, parsePlan } from '../parse-plan'
import { parsedPlanToSnapshots } from '../plan-to-snapshots'
import {
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
import { type PoseKind, type PoseSet, poseSetsForCandidate } from './pose-sets'
import { worldStateObstacleTransforms } from './world-state-obstacles'

export type IKSortMode = 'seed' | 'cost'
export type IKInspectionStatus = 'idle' | 'loading' | 'ready' | 'error'

const ALL_STATUSES: IKStatus[] = ['valid', 'path-invalid', 'invalid']

const allVisible = (): Record<PoseKind, boolean> => ({ start: true, lastGood: true, end: true })

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
	readonly isOpen: boolean
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
	setOpen: (open: boolean) => void
	inspect: (planName: string, planContent: string) => Promise<void>
	select: (id: string | null) => void
	toggleStatusFilter: (status: IKStatus) => void
	resetStatusFilter: () => void
	setSortMode: (mode: IKSortMode) => void
	toggleSeed: (seedIndex: number) => void
	setPoseVisible: (kind: PoseKind, visible: boolean) => void
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

	let isOpen = $state(false)
	let status = $state<IKInspectionStatus>('idle')
	let error = $state<string | null>(null)
	let planName = $state<string | null>(null)
	let selectedId = $state<string | null>(null)
	let sortMode = $state<IKSortMode>('seed')
	let poseVisibility = $state<Record<PoseKind, boolean>>(allVisible())
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

	const clearPoseSets = () => {
		for (const drawn of drawnSets.values()) destroyDrawnSet(drawn)
		drawnSets.clear()
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

	const inspect = async (name: string, planContent: string) => {
		clear()
		planName = name
		status = 'loading'
		isOpen = true

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

	const setOpen = (open: boolean) => {
		if (open === isOpen) return
		isOpen = open

		// Geometry the user cannot reach from a closed panel is worse than a redraw on reopen.
		if (open) {
			ensureObstacles()
			drawSelection()
		} else {
			teardownScene()
		}
	}

	context = {
		get isOpen() {
			return isOpen
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
		setOpen,
		inspect,
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
