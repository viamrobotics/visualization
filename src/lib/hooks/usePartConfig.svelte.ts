import type { JsonValue } from '@viamrobotics/sdk'

import { Struct } from '@viamrobotics/sdk'
import { createAppMutation, createAppQuery } from '@viamrobotics/svelte-sdk'
import { StateHistory } from 'runed'
import { getContext, setContext, untrack } from 'svelte'

import { useWorld } from '$lib/ecs'
import {
	applyFrameHistorySnapshotToWorld,
	parsePartConfigSnapshot,
	serializePartConfig,
} from '$lib/editing/frameHistory'
import { createFrame, type Frame } from '$lib/frame'
import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import { Pose } from '$lib/math'

const key = Symbol('part-config-context')

export interface PartConfig {
	components: { name: string; api?: string; frame?: Frame }[]
	fragment_mods?: {
		fragment_id: string
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mods: any[]
	}[]
}

interface LocalPartConfig {
	readonly isReady: boolean
	isDirty: boolean
	hasEditPermissions: boolean
	current: Struct
	/**
	 * Why the config is unavailable, when it is. Stays undefined while the config
	 * is still loading, so consumers can tell "not ready yet" from "will never
	 * arrive" instead of flashing an error during startup.
	 */
	error?: string

	set: (config: PartConfig, options?: { dirty?: boolean }) => void
	save?: () => void
	discardChanges?: () => void
}

interface PartConfigContext {
	current: PartConfig
	/** Whether the initial config snapshot for the selected part has settled. */
	readonly isReady: boolean
	isDirty: boolean
	hasEditPermissions: boolean
	/** Why the config is unavailable — see `LocalPartConfig.error`. */
	error?: string

	/**
	 * The config as last committed: saved here, discarded back to the stored
	 * copy, or pushed down by the embedder. A discard restores the previous
	 * value, so a consumer watching this for changes sees saves and not edits.
	 */
	readonly savedSnapshot: string

	updateFrame: (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => void
	deleteFrame: (componentName: string) => void
	createFrame: (componentName: string) => void
	save: () => void
	discardChanges: () => void
	canUndoFrameEdit: boolean
	canRedoFrameEdit: boolean
	undoFrameEdit: () => void
	redoFrameEdit: () => void
	beginFrameEditHistoryEntry: () => void
	endFrameEditHistoryEntry: () => void
}

export const providePartConfig = (
	partID: () => string,
	params: () => AppEmbeddedPartConfigProps | undefined
) => {
	const props = $derived(params())
	const config = $derived(props ? useEmbeddedPartConfig(props) : useStandalonePartConfig(partID))
	const fragmentInfo = useFragmentInfo()
	const world = useWorld()

	const getCurrent = () => {
		return (config.current?.toJson?.() ?? { components: [] }) as unknown as PartConfig
	}

	const current = $derived(getCurrent())
	const currentSnapshot = $derived(serializePartConfig(current))
	let historySnapshot = $state(currentSnapshot)

	let cleanSnapshot = $state(serializePartConfig(undefined))
	let historyActive = $state(false)
	let historyTransactionDepth = $state(0)
	let transactionStartSnapshot = $state<string | undefined>()
	let applyingHistory = false

	$effect(() => {
		if (historyTransactionDepth === 0 && historySnapshot !== currentSnapshot) {
			historySnapshot = currentSnapshot
		}
	})

	$effect(() => {
		if (!config.isDirty) {
			cleanSnapshot = currentSnapshot
		}
	})

	/**
	 * Once the edits are committed — saved, discarded, or saved by the embedder —
	 * the config is the new baseline, so fold it into the world: write the config
	 * poses into `Matrix` / `LiveMatrix` and drop `EditedMatrix`. Without this the
	 * staged edit outlives the save, and as soon as `useFrames` re-derives the
	 * baseline from the saved config the blend (live × baseline⁻¹ × edited)
	 * cancels the edit against a `LiveMatrix` that still holds the pre-save pose —
	 * the frame snaps back to where it started. Edge-triggered on dirty → clean so
	 * it never fights `usePoses` while merely monitoring.
	 */
	let wasDirty = false
	let cleanSettlement: 'save' | 'discard' = 'save'
	$effect(() => {
		const settled = wasDirty && !config.isDirty
		wasDirty = config.isDirty

		if (!settled) return

		untrack(() => {
			applyFrameHistorySnapshotToWorld(world, current, fragmentInfo.current, {
				mode: cleanSettlement,
			})
			cleanSettlement = 'save'
		})
	})

	let historyPartID: string | undefined
	$effect(() => {
		const id = partID()
		if (historyPartID !== undefined && historyPartID !== id) {
			historyActive = false
		}
		historyPartID = id
	})

	const applyHistorySnapshot = (snapshot: string) => {
		applyingHistory = true
		try {
			historySnapshot = snapshot
			const nextConfig = parsePartConfigSnapshot(snapshot) as PartConfig
			const isClean = snapshot === cleanSnapshot
			config.set(nextConfig, { dirty: !isClean })
			applyFrameHistorySnapshotToWorld(world, nextConfig, fragmentInfo.current, {
				mode: isClean ? 'discard' : 'edit',
			})
		} finally {
			applyingHistory = false
		}
	}

	const history = new StateHistory(() => historySnapshot, applyHistorySnapshot)

	const markHistoryActive = () => {
		if (applyingHistory) {
			return
		}

		historyActive = true
	}

	const deactivateHistory = () => {
		historyActive = false
		historyTransactionDepth = 0
		transactionStartSnapshot = undefined
		historySnapshot = currentSnapshot
	}

	const hasSettledHistorySnapshot = () => historySnapshot === currentSnapshot

	const canUseHistory = () =>
		historyTransactionDepth === 0 && historyActive && hasSettledHistorySnapshot()

	const beginFrameEditHistoryEntry = () => {
		if (applyingHistory) {
			return
		}

		markHistoryActive()
		if (historyTransactionDepth === 0) {
			transactionStartSnapshot = currentSnapshot
			if (historySnapshot !== currentSnapshot) {
				historySnapshot = currentSnapshot
			}
		}
		historyTransactionDepth += 1
	}

	const endFrameEditHistoryEntry = () => {
		if (historyTransactionDepth === 0) {
			return
		}

		historyTransactionDepth -= 1
		if (historyTransactionDepth > 0) {
			return
		}

		const start = transactionStartSnapshot
		transactionStartSnapshot = undefined
		if (start !== currentSnapshot) {
			historySnapshot = currentSnapshot
		}
	}

	const createFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		let fragmentMod = newConfig.fragment_mods.find((mod) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modSetPath = `components.${componentName}.frame`
		const frame = {
			['$set']: {
				[modSetPath]: createFrame(),
			},
		}

		fragmentMod.mods.push(frame)
		config.set(newConfig)
	}

	const createPartFrame = (componentName: string) => {
		const newConfig = getCurrent()
		const component = newConfig?.components?.find((comp) => comp.name === componentName)
		if (component) {
			component.frame = createFrame()
		}
		config.set(newConfig)
	}

	const updateFragmentFrame = (
		fragmentId: string,
		componentName: string,
		referenceFrame: string,
		framePosition: Pose,
		frameGeometry?: Frame['geometry']
	) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		let fragmentMod = newConfig.fragment_mods.find(
			(mod: { fragment_id: string }) => mod.fragment_id === fragmentId
		)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modSetPath = `components.${componentName}.frame`
		const frame = {
			['$set']: {
				[modSetPath]: {
					translation: {
						x: framePosition.x,
						y: framePosition.y,
						z: framePosition.z,
					},
					parent: referenceFrame,
					orientation: {
						type: 'ov_degrees',
						value: {
							x: framePosition.oX,
							y: framePosition.oY,
							z: framePosition.oZ,
							th: framePosition.theta,
						},
					},
					geometry:
						frameGeometry && frameGeometry.type !== 'none' ? { ...frameGeometry } : undefined,
				},
			},
		}
		if (frameGeometry === undefined || frameGeometry.type === 'none') {
			delete frame['$set'][modSetPath].geometry
		}

		const existingFrameIndex = fragmentMod.mods.findLastIndex(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(mod: any) => mod?.['$set']?.[modSetPath] !== undefined
		)
		if (existingFrameIndex === -1) {
			fragmentMod.mods.push(frame)
		} else {
			const existingGeometry = fragmentMod.mods[existingFrameIndex]['$set']?.[modSetPath].geometry
			if (existingGeometry && !frameGeometry) {
				frame['$set'][modSetPath].geometry = existingGeometry
			}
			fragmentMod.mods[existingFrameIndex] = frame
		}

		config.set(newConfig)
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => {
		const newConfig = getCurrent()
		const component = newConfig.components?.find(({ name }) => name === componentName)

		if (!component) {
			return
		}

		if (component.frame) {
			const currentPose = new Pose().setFromFrame(component.frame)

			component.frame.parent = referenceFrame
			component.frame.translation = {
				x: pose.x ?? currentPose.x,
				y: pose.y ?? currentPose.y,
				z: pose.z ?? currentPose.z,
			}

			component.frame.orientation = {
				type: 'ov_degrees',
				value: {
					x: pose.oX ?? currentPose.oX,
					y: pose.oY ?? currentPose.oY,
					z: pose.oZ ?? currentPose.oZ,
					th: pose.theta ?? currentPose.theta,
				},
			}

			if (geometry) {
				if (geometry.type === 'none') {
					delete component.frame.geometry
				} else {
					component.frame.geometry = { ...geometry }
				}
			}
		}

		config.set(newConfig)
	}

	const deletePartFrame = (componentName: string) => {
		const newConfig = getCurrent()
		const component = newConfig?.components?.find(({ name }) => name === componentName)

		if (component) {
			delete component.frame
			config.set(newConfig)
		}
	}

	const deleteFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let fragmentMod = newConfig.fragment_mods.find((mod: any) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modUnSetPath = `components.${componentName}.frame`
		fragmentMod.mods.push({
			['$unset']: {
				[modUnSetPath]: '',
			},
		})
		config.set(newConfig)
	}

	setContext<PartConfigContext>(key, {
		get current() {
			return current
		},
		get isReady() {
			return config.isReady
		},
		get isDirty() {
			return config.isDirty
		},
		get hasEditPermissions() {
			return config.hasEditPermissions
		},
		get error() {
			return config.error
		},
		get savedSnapshot() {
			return cleanSnapshot
		},

		updateFrame: (
			componentName: string,
			referenceFrame: string,
			framePosition: Pose,
			frameGeometry?: Frame['geometry']
		) => {
			markHistoryActive()
			const fragmentId = fragmentInfo.current[componentName]?.id
			if (fragmentId === undefined) {
				updatePartFrame(componentName, referenceFrame, framePosition, frameGeometry)
			} else {
				updateFragmentFrame(fragmentId, componentName, referenceFrame, framePosition, frameGeometry)
			}
		},

		deleteFrame: (componentName: string) => {
			markHistoryActive()
			const fragmentId = fragmentInfo.current[componentName]?.id
			if (fragmentId === undefined) {
				deletePartFrame(componentName)
			} else {
				deleteFragmentFrame(fragmentId, componentName)
			}
		},
		createFrame: (componentName: string) => {
			markHistoryActive()
			const fragmentId = fragmentInfo.current[componentName]?.id
			if (fragmentId === undefined) {
				createPartFrame(componentName)
			} else {
				createFragmentFrame(fragmentId, componentName)
			}
		},
		save: () => {
			deactivateHistory()
			cleanSettlement = 'save'
			config.save?.()
		},
		discardChanges: () => {
			deactivateHistory()
			cleanSettlement = 'discard'
			config.discardChanges?.()
		},
		get canUndoFrameEdit() {
			return canUseHistory() && config.isDirty && history.canUndo
		},
		get canRedoFrameEdit() {
			return canUseHistory() && history.canRedo
		},
		undoFrameEdit: () => {
			if (!canUseHistory() || !config.isDirty || !history.canUndo) {
				return
			}

			history.undo()
		},
		redoFrameEdit: () => {
			if (canUseHistory() && history.canRedo) {
				history.redo()
			}
		},
		beginFrameEditHistoryEntry,
		endFrameEditHistoryEntry,
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface AppEmbeddedPartConfigProps {
	current: Struct
	isDirty: boolean

	setLocalPartConfig: (config: Struct) => void
}

const useEmbeddedPartConfig = (props: AppEmbeddedPartConfigProps): LocalPartConfig => {
	return {
		isReady: true,
		hasEditPermissions: true,
		get isDirty() {
			return props.isDirty
		},

		get current() {
			return props.current ?? new Struct()
		},

		set(config: PartConfig): void {
			const struct = Struct.fromJson(config as unknown as JsonValue)
			return props.setLocalPartConfig(struct)
		},
	}
}

const useStandalonePartConfig = (partID: () => string): LocalPartConfig => {
	const partQuery = createAppQuery('getRobotPart', () => [partID()] as const, {
		refetchInterval: false,
	})
	const partName = $derived(partQuery.data?.part?.name)

	// Use part.robotConfig (the stored Struct config) as the authoritative source.
	// configJson is the compiled running config from the robot daemon and may be empty
	// even when the stored config exists and the API key has edit permissions.
	let networkPartConfig = $derived(partQuery.data?.part?.robotConfig)
	let current = $state.raw<Struct>()
	let isDirty = $state(false)

	const hasEditPermissions = $derived(networkPartConfig !== undefined)

	/**
	 * Distinguishes the two ways the config can be missing from the third, benign
	 * one (still in flight). Without this every frame edit silently no-ops:
	 * `updatePartFrame` finds no matching component and returns, so nothing
	 * dirties and Save never enables.
	 */
	const error = $derived.by(() => {
		if (partQuery.error) {
			return partQuery.error.message
		}

		// The app omits `robotConfig` when the caller can't read the machine's
		// stored config, so a successful response with nothing in it means the
		// credentials lack config access rather than that the part is empty.
		if (partQuery.data !== undefined && networkPartConfig === undefined) {
			return 'This machine returned no stored configuration.'
		}

		return undefined
	})

	let lastPartID: string | undefined
	$effect.pre(() => {
		const id = partID()
		if (lastPartID !== undefined && lastPartID !== id) {
			// Part changed: drop any in-memory edits from the previous part, and
			// clear `current` so consumers don't keep rendering the old config's
			// frames while the new part loads (offline parts may never load,
			// leaving the old frames forever).
			isDirty = false
			current = undefined
		}
		lastPartID = id

		if (!networkPartConfig || isDirty) {
			return
		}

		current = networkPartConfig
	})

	const updateRobotPartMutation = createAppMutation('updateRobotPart')

	return {
		get isReady() {
			return (
				partID() !== '' &&
				!partQuery.isFetching &&
				(partQuery.data !== undefined || partQuery.error !== undefined)
			)
		},
		get current() {
			return current ?? new Struct()
		},
		get isDirty() {
			return isDirty
		},
		get hasEditPermissions() {
			return hasEditPermissions
		},
		get error() {
			return error
		},

		set(config: PartConfig, options?: { dirty?: boolean }): void {
			current = Struct.fromJson(config as unknown as JsonValue)
			isDirty = options?.dirty ?? true
		},

		async save() {
			if (!current || !partName) {
				return
			}

			networkPartConfig = current
			await updateRobotPartMutation.mutateAsync([partID(), partName, current])
			isDirty = false
		},

		discardChanges() {
			current = networkPartConfig
			isDirty = false
		},
	}
}
