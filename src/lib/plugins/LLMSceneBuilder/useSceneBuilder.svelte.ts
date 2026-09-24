import { getContext, setContext } from 'svelte'

import type { Frame, FrameEulerDegrees } from '$lib/frame'

import { useConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import { useFrames } from '$lib/hooks/useFrames.svelte'
import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
import { Pose } from '$lib/math'

import {
	type FrameDelta,
	resolveFragmentCurrentFrames,
	type UpdateError,
	validateProposedFrameDeltas,
} from './frameDeltaAdapter'

const key = Symbol('scene-builder-context')

type UIState = 'idle' | 'loading' | 'diff' | 'error'

interface FieldChange {
	field: string
	oldValue: string
	newValue: string
}

interface DiffGroup {
	componentName: string
	explanation?: string
	changes: FieldChange[]
}

interface SceneBuilderContext {
	readonly uiState: UIState
	readonly updateErrors: UpdateError[]
	readonly explanation: string
	readonly errorMessage: string
	readonly diffGroups: DiffGroup[]
	submit(prompt: string): Promise<void>
	confirm(): void
	cancel(): void
	resetError(): void
}

export interface ComponentFrameInfo {
	name: string
	frame: {
		parent: Frame['parent']
		translation: Frame['translation']
		/** Euler degrees, not `Frame['orientation']`. Stored frames use OV or quaternion, and the callback receives the Euler-degrees projection of that orientation. */
		orientation: FrameEulerDegrees
		geometry?: Frame['geometry']
	}
}

export type InferCallback = (
	prompt: string,
	components: ComponentFrameInfo[]
) => Promise<{ updates: FrameDelta[]; explanation?: string; refusal?: string }>

export const provideSceneBuilder = (onInfer: InferCallback): void => {
	const partConfig = usePartConfig()
	const fragmentInfo = useFragmentInfo()
	const frames = useFrames()
	const configFrames = useConfigFrames()

	const fragmentFrames = $derived(
		resolveFragmentCurrentFrames(
			Object.keys(fragmentInfo.current),
			fragmentInfo.current,
			frames.current ?? [],
			configFrames.current ?? {}
		)
	)

	let uiState = $state<UIState>('idle')
	let deltas = $state<FrameDelta[]>([])
	let explanation = $state('')
	let errorMessage = $state('')

	// Re-derived whenever deltas or the current config changes (e.g. from a drag).
	// confirm() therefore always applies the LLM's intent against the latest config —
	// drag changes to unspecified axes are preserved, not overwritten.
	const validation = $derived.by(() =>
		deltas.length > 0
			? validateProposedFrameDeltas(deltas, partConfig.current, fragmentFrames)
			: { prepared: [], errors: [] }
	)

	const updateErrors = $derived(validation.errors)

	const diffGroups = $derived(
		validation.prepared.flatMap((u): DiffGroup[] => {
			const changes: FieldChange[] = []
			const roundMm = (v: number) => `${Math.round(v * 100) / 100}mm`
			const roundDeg = (v: number) => `${Math.round(v * 100) / 100}°`

			if (u.parent !== u.previousParent) {
				changes.push({ field: 'parent', oldValue: u.previousParent, newValue: u.parent })
			}
			if (u.pose.x !== u.previousPose.x) {
				changes.push({
					field: 'translation.x',
					oldValue: roundMm(u.previousPose.x),
					newValue: roundMm(u.pose.x),
				})
			}
			if (u.pose.y !== u.previousPose.y) {
				changes.push({
					field: 'translation.y',
					oldValue: roundMm(u.previousPose.y),
					newValue: roundMm(u.pose.y),
				})
			}
			if (u.pose.z !== u.previousPose.z) {
				changes.push({
					field: 'translation.z',
					oldValue: roundMm(u.previousPose.z),
					newValue: roundMm(u.pose.z),
				})
			}
			if (
				u.pose.oX !== u.previousPose.oX ||
				u.pose.oY !== u.previousPose.oY ||
				u.pose.oZ !== u.previousPose.oZ ||
				u.pose.theta !== u.previousPose.theta
			) {
				const prev = u.previousPose.toEulerDegrees()
				const next = u.pose.toEulerDegrees()
				for (const axis of ['yaw', 'pitch', 'roll'] as const) {
					if (Math.abs(next[axis] - prev[axis]) > 0.01) {
						changes.push({
							field: axis,
							oldValue: roundDeg(prev[axis]),
							newValue: roundDeg(next[axis]),
						})
					}
				}
			}

			const geomFields = (g?: Frame['geometry']): Record<string, string> => {
				if (!g) return {}
				if (g.type === 'none') return { 'geometry.type': 'none' }
				if (g.type === 'box') {
					return {
						'geometry.type': 'box',
						'geometry.x': roundMm(g.x),
						'geometry.y': roundMm(g.y),
						'geometry.z': roundMm(g.z),
					}
				}
				if (g.type === 'sphere') {
					return { 'geometry.type': 'sphere', 'geometry.r': roundMm(g.r) }
				}
				return {
					'geometry.type': 'capsule',
					'geometry.r': roundMm(g.r),
					'geometry.l': roundMm(g.l),
				}
			}
			const prevGeom = geomFields(u.previousGeometry)
			const nextGeom = geomFields(u.geometry)
			for (const field of new Set([...Object.keys(prevGeom), ...Object.keys(nextGeom)])) {
				const oldValue = prevGeom[field] ?? '—'
				const newValue = nextGeom[field] ?? '—'
				if (oldValue !== newValue) {
					changes.push({ field, oldValue, newValue })
				}
			}

			return changes.length > 0
				? [{ componentName: u.componentName, explanation: u.explanation, changes }]
				: []
		})
	)

	const clear = () => {
		deltas = []
		explanation = ''
		errorMessage = ''
	}

	setContext<SceneBuilderContext>(key, {
		get uiState() {
			return uiState
		},
		get updateErrors() {
			return updateErrors
		},
		get explanation() {
			return explanation
		},
		get errorMessage() {
			return errorMessage
		},
		get diffGroups() {
			return diffGroups
		},

		async submit(prompt: string) {
			uiState = 'loading'

			const partComponents = partConfig.current.components
				.filter((c) => c.frame !== undefined)
				.map(({ name, frame }) => {
					const pose = new Pose().setFromFrame(frame!)
					const orientation = pose.toEulerDegrees()
					return {
						name,
						frame: {
							parent: frame!.parent,
							translation: frame!.translation,
							orientation,
							geometry: frame!.geometry,
						},
					}
				})

			// Fragment components never appear in partConfig.components, so there's
			// no name overlap with partComponents.
			const fragmentComponents = Object.entries(fragmentFrames)
				.filter(([, current]) => current.frame !== undefined)
				.map(([name, current]) => {
					const pose = new Pose().setFromFrame(current.frame!)
					const orientation = pose.toEulerDegrees()
					return {
						name,
						frame: {
							parent: current.frame!.parent,
							translation: current.frame!.translation,
							orientation,
							geometry: current.frame!.geometry,
						},
					}
				})

			const components = [...partComponents, ...fragmentComponents]

			try {
				const data = await onInfer(prompt.trim(), components)
				// The LLM refuses requests it can't fulfil (e.g. adding a component);
				// surface the message in the error state instead of an empty diff.
				if (data.refusal) {
					errorMessage = data.refusal
					uiState = 'error'
					return
				}
				deltas = data.updates
				explanation = data.explanation ?? ''
				uiState = 'diff'
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error)
				uiState = 'error'
			}
		},

		confirm() {
			for (const update of validation.prepared) {
				partConfig.updateFrame(update.componentName, update.parent, update.pose, update.geometry)
			}
			clear()
			uiState = 'idle'
		},

		cancel() {
			clear()
			uiState = 'idle'
		},

		resetError() {
			errorMessage = ''
			uiState = 'idle'
		},
	})
}

export const useSceneBuilder = (): SceneBuilderContext => {
	return getContext<SceneBuilderContext>(key)
}
