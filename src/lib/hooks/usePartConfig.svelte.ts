import type { JsonValue } from '@viamrobotics/sdk'

import { Struct } from '@viamrobotics/sdk'
import { createAppMutation, createAppQuery } from '@viamrobotics/svelte-sdk'
import { StateHistory } from 'runed'
import { getContext, setContext, untrack } from 'svelte'

import { useWorld } from '#lib/ecs/index.js'
import {
	applyFrameHistorySnapshotToWorld,
	parsePartConfigSnapshot,
	serializePartConfig,
} from '#lib/editing/frameHistory.js'
import { createFrame, type Frame } from '#lib/frame.js'
import { frameModOperations, replaceFrameMods } from '#lib/frameFragmentMods.js'
import { hasViamAppClient } from '#lib/hooks/hasViamAppClient.js'
import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
import { Pose } from '#lib/math/index.js'
import { mergedComponentFrames, resolveComponentFrames } from '#lib/resolveComponentFrames.js'

import { type PartComponentPatch, patchPartComponent } from './patchPartComponent'
import { removePartComponent } from './removePartComponent'

const key = Symbol('part-config-context')

/** The fields of a `components` entry this app reads or writes, not the whole entry. */
export interface PartComponent {
	name: string
	api?: string
	model?: string
	frame?: Frame
	attributes?: Record<string, unknown>
	visualizer?: Record<string, unknown>
}

/** The fields of a `modules` entry this app writes, not the whole entry. */
export interface PartModule {
	type: 'registry'
	name: string
	module_id: string
	version: string
}

export interface PartConfig {
	components: PartComponent[]
	/** Only `name` is read, to keep new component names unique. */
	services?: { name: string }[]
	modules?: PartModule[]
	fragment_mods?: {
		fragment_id: string
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mods: any[]
	}[]
}

/**
 * `next` with `current`'s geometry offset filled in wherever `next` sets none. Geometry
 * editors write dimensions only, so without this a resize moves the shape to the frame origin.
 */
const mergeGeometryOffset = (
	next: NonNullable<Frame['geometry']>,
	current: Frame['geometry']
): NonNullable<Frame['geometry']> => {
	if (next.type === 'none' || !current || current.type === 'none') {
		return { ...next }
	}

	const translation = next.translation ?? current.translation
	const orientation = next.orientation ?? current.orientation

	return {
		...next,
		...(translation && { translation }),
		...(orientation && { orientation }),
	}
}

interface LocalPartConfig {
	readonly isReady: boolean
	isDirty: boolean
	hasEditPermissions: boolean
	/** See `PartConfigContext.hasConfigSource`. */
	readonly hasConfigSource: boolean
	current: Struct
	/**
	 * Why the config is unavailable, when it is. Stays undefined while the config
	 * is still loading, so consumers can tell "not ready yet" from "will never
	 * arrive" instead of flashing an error during startup.
	 */
	error?: string

	set: (config: PartConfig, options?: { dirty?: boolean }) => void
	save?: () => void | Promise<void>
	discardChanges?: () => void
}

export interface PartConfigContext {
	current: PartConfig
	/** Whether the initial config snapshot for the selected part has settled. */
	readonly isReady: boolean
	isDirty: boolean
	hasEditPermissions: boolean
	/**
	 * Whether anything can load and save this part's config: the host's
	 * `localConfigProps`, or the app client. False when the Visualizer is embedded
	 * with only a machine connection, where config editing has nowhere to go.
	 */
	readonly hasConfigSource: boolean
	/**
	 * Whether `save` writes the config itself. False when embedded, where an edit stays
	 * staged in the host until the user saves it there.
	 */
	readonly canSave: boolean
	/** Why the config is unavailable — see `LocalPartConfig.error`. */
	error?: string

	updateFrame: (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => void
	deleteFrame: (componentName: string) => void
	/**
	 * Removes each named component's frame in one write and one undo step. See `createComponents`
	 * for why separate calls are not enough.
	 */
	deleteFrames: (componentNames: readonly string[]) => void
	/**
	 * Runs `edit`, landing every config edit it makes as one write. Separate writes would each start
	 * from the config an embedding host may not have passed back yet, and undo one another.
	 */
	batchEdits: (edit: () => void) => void
	createFrame: (componentName: string) => void
	/**
	 * Appends `component` to the part's own components. A name already in the config is left alone.
	 *
	 * @param module Appended to the part's modules in the same edit, unless one with its `module_id`
	 *   is already there, so the model `component` names has something to load it.
	 */
	createComponent: (component: PartComponent, module?: PartModule) => void
	/**
	 * Appends each of `components` to the part's own components in one write and one undo step.
	 * Separate `createComponent` calls would each read the config the last one wrote, which an
	 * embedding host may not have passed back yet. A name already in the config is left alone.
	 */
	createComponents: (components: readonly PartComponent[]) => void
	/**
	 * Replaces the fields in `patch` on a part-owned component, as one undo step. A fragment's
	 * component is left alone.
	 */
	updateComponent: (componentName: string, patch: PartComponentPatch) => void
	/**
	 * Replaces the fields in each patch on its part-owned component, keyed by name, in one write and
	 * one undo step. See `createComponents` for why separate calls are not enough.
	 */
	updateComponents: (patches: ReadonlyMap<string, PartComponentPatch>) => void
	/** Removes a part-owned component, as one undo step. Its modules stay. */
	deleteComponent: (componentName: string) => void
	/**
	 * Removes each named part-owned component in one write and one undo step. Their modules stay.
	 * See `createComponents` for why separate calls are not enough.
	 */
	deleteComponents: (componentNames: readonly string[]) => void
	/**
	 * Writes the staged edits. A failure goes to the `onError` given to `providePartConfig`.
	 *
	 * @returns Whether the config was saved.
	 */
	save: () => Promise<boolean>
	discardChanges: () => void
	canUndoFrameEdit: boolean
	canRedoFrameEdit: boolean
	undoFrameEdit: () => void
	redoFrameEdit: () => void
	beginFrameEditHistoryEntry: () => void
	endFrameEditHistoryEntry: () => void
}

/**
 * @param onError Shows the user a failure they need to know about, such as a save that did not
 * land. Omit it and the failure is only reported by `save` resolving `false`.
 */
export const providePartConfig = (
	partID: () => string,
	params: () => AppEmbeddedPartConfigProps | undefined,
	onError?: (message: string) => void
) => {
	const props = $derived(params())
	const hasAppClient = hasViamAppClient()
	const config = $derived.by(() => {
		if (props) return useEmbeddedPartConfig(props)
		if (hasAppClient) return useStandalonePartConfig(partID)
		return useDetachedPartConfig()
	})
	const fragmentInfo = useFragmentInfo()
	const world = useWorld()

	const getCurrent = () => {
		return (config.current?.toJson?.() ?? { components: [] }) as unknown as PartConfig
	}

	/** The working copy every edit reads and writes while `batchEdits` runs. */
	let batchDraft: PartConfig | undefined
	let isBatchWritten = false

	/** The config an edit starts from: the batch's working copy inside `batchEdits`, else the current one. */
	const readForEdit = (): PartConfig => batchDraft ?? getCurrent()

	/** Writes an edit, or holds it in the batch's working copy for `batchEdits` to write once. */
	const writeEdit = (next: PartConfig) => {
		if (batchDraft === undefined) {
			config.set(next)
			return
		}
		batchDraft = next
		isBatchWritten = true
	}

	const batchEdits = (edit: () => void) => {
		if (batchDraft !== undefined) {
			edit()
			return
		}

		batchDraft = getCurrent()
		isBatchWritten = false
		try {
			edit()
		} finally {
			const draft = batchDraft
			batchDraft = undefined
			if (isBatchWritten) config.set(draft)
		}
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
		const newConfig = readForEdit()
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
		writeEdit(newConfig)
	}

	const createPartComponents = (added: readonly PartComponent[], module?: PartModule) => {
		const newConfig = readForEdit()
		const components = newConfig.components ?? []
		const takenNames = new Set(components.map(({ name }) => name))
		const fresh = added.filter(({ name }) => !takenNames.has(name))

		if (fresh.length === 0) {
			return
		}

		newConfig.components = [...components, ...fresh]

		const modules = newConfig.modules ?? []
		if (module && !modules.some(({ module_id }) => module_id === module.module_id)) {
			newConfig.modules = [...modules, module]
		}

		writeEdit(newConfig)
	}

	const createPartFrame = (componentName: string) => {
		const newConfig = readForEdit()
		const component = newConfig?.components?.find((comp) => comp.name === componentName)
		if (component) {
			component.frame = createFrame()
		}
		writeEdit(newConfig)
	}

	const updateFragmentFrame = (
		fragmentId: string,
		componentName: string,
		referenceFrame: string,
		framePosition: Pose,
		frameGeometry?: Frame['geometry']
	) => {
		const newConfig = readForEdit()
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

		// The pose the user started this edit from, so an unspecified geometry
		// keeps whatever the frame already resolved to rather than vanishing.
		const effectiveFrame = mergedComponentFrames(
			resolveComponentFrames(newConfig, fragmentInfo.current)
		).get(componentName)

		const geometry = frameGeometry
			? mergeGeometryOffset(frameGeometry, effectiveFrame?.geometry)
			: effectiveFrame?.geometry
		const nextFrame: Frame = {
			...effectiveFrame,
			parent: referenceFrame,
			translation: {
				x: framePosition.x,
				y: framePosition.y,
				z: framePosition.z,
			},
			orientation: {
				type: 'ov_degrees',
				value: {
					x: framePosition.oX,
					y: framePosition.oY,
					z: framePosition.oZ,
					th: framePosition.theta,
				},
			},
		}

		if (geometry && geometry.type !== 'none') {
			nextFrame.geometry = { ...geometry }
		} else {
			delete nextFrame.geometry
		}

		fragmentMod.mods = replaceFrameMods(
			fragmentMod.mods as Record<string, unknown>[],
			componentName,
			frameModOperations(componentName, fragmentInfo.current[componentName]?.frame, nextFrame)
		)

		writeEdit(newConfig)
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => {
		const newConfig = readForEdit()
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
					component.frame.geometry = mergeGeometryOffset(geometry, component.frame.geometry)
				}
			}
		}

		writeEdit(newConfig)
	}

	/** Removes a frame from `newConfig` in place. Returns whether there was one to remove. */
	const removeFrameFrom = (newConfig: PartConfig, componentName: string): boolean => {
		const fragmentId = fragmentInfo.current[componentName]?.id
		if (fragmentId !== undefined) {
			unsetFragmentFrame(newConfig, fragmentId, componentName)
			return true
		}

		const component = newConfig.components?.find(({ name }) => name === componentName)
		if (!component) return false

		delete component.frame
		return true
	}

	const unsetFragmentFrame = (newConfig: PartConfig, fragmentId: string, componentName: string) => {
		newConfig.fragment_mods ??= []

		let fragmentMod = newConfig.fragment_mods.find((mod) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		fragmentMod.mods = replaceFrameMods(
			fragmentMod.mods as Record<string, unknown>[],
			componentName,
			[{ ['$unset']: { [`components.${componentName}.frame`]: '' } }]
		)
	}

	const deleteFrames = (componentNames: readonly string[]) => {
		const newConfig = readForEdit()
		let isRemoved = false
		for (const componentName of componentNames) {
			if (removeFrameFrom(newConfig, componentName)) isRemoved = true
		}
		if (isRemoved) writeEdit(newConfig)
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
		get hasConfigSource() {
			return config.hasConfigSource
		},
		get canSave() {
			return config.save !== undefined
		},
		get error() {
			return config.error
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
			deleteFrames([componentName])
		},
		deleteFrames: (componentNames: readonly string[]) => {
			markHistoryActive()
			deleteFrames(componentNames)
		},
		batchEdits,
		createFrame: (componentName: string) => {
			markHistoryActive()
			const fragmentId = fragmentInfo.current[componentName]?.id
			if (fragmentId === undefined) {
				createPartFrame(componentName)
			} else {
				createFragmentFrame(fragmentId, componentName)
			}
		},
		createComponent: (component: PartComponent, module?: PartModule) => {
			markHistoryActive()
			createPartComponents([component], module)
		},
		createComponents: (components: readonly PartComponent[]) => {
			markHistoryActive()
			createPartComponents(components)
		},
		updateComponent: (componentName: string, patch: PartComponentPatch) => {
			markHistoryActive()
			const newConfig = readForEdit()
			if (patchPartComponent(newConfig, componentName, patch)) {
				writeEdit(newConfig)
			}
		},
		updateComponents: (patches: ReadonlyMap<string, PartComponentPatch>) => {
			markHistoryActive()
			const newConfig = readForEdit()
			let isPatched = false
			for (const [componentName, patch] of patches) {
				if (patchPartComponent(newConfig, componentName, patch)) isPatched = true
			}
			if (isPatched) writeEdit(newConfig)
		},
		deleteComponent: (componentName: string) => {
			markHistoryActive()
			const newConfig = readForEdit()
			if (removePartComponent(newConfig, componentName)) {
				writeEdit(newConfig)
			}
		},
		deleteComponents: (componentNames: readonly string[]) => {
			markHistoryActive()
			const newConfig = readForEdit()
			let isRemoved = false
			for (const componentName of componentNames) {
				if (removePartComponent(newConfig, componentName)) isRemoved = true
			}
			if (isRemoved) writeEdit(newConfig)
		},
		save: async () => {
			deactivateHistory()
			cleanSettlement = 'save'
			try {
				await config.save?.()
				return true
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				onError?.(`Couldn't save the config: ${reason}`)
				return false
			}
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
		hasConfigSource: true,
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

/**
 * The config of a Visualizer embedded with only a machine connection. Nothing can
 * load or save the part's stored config, so it reads as empty and never editable.
 * The scene still draws from the machine's frame system.
 */
const useDetachedPartConfig = (): LocalPartConfig => {
	return {
		isReady: true,
		isDirty: false,
		hasEditPermissions: false,
		hasConfigSource: false,
		current: new Struct(),
		set: () => {},
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
		hasConfigSource: true,
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
				throw new Error('The machine config has not loaded yet.')
			}

			const saving = current
			await updateRobotPartMutation.mutateAsync([partID(), partName, saving])
			// Only after the write lands, so a failed save leaves Discard pointing at the server's copy.
			networkPartConfig = saving
			isDirty = false
		},

		discardChanges() {
			current = networkPartConfig
			isDirty = false
		},
	}
}
