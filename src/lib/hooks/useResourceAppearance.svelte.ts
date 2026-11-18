import { getContext, setContext, untrack } from 'svelte'

import type { SavedAppearance } from '$lib/resourceAppearance'

import { useQuery } from '$lib/ecs'
import { applyFrameAppearance } from '$lib/ecs/applyFrameAppearance'
import { resolvedAppearanceByComponent } from '$lib/resolvedAppearance'

import { useEnvironment } from './useEnvironment.svelte'
import { FRAME_ENTITY_QUERY } from './useFrameEntities.svelte'
import { usePartConfig } from './usePartConfig.svelte'

export const RESOURCE_APPEARANCE_CONTEXT_KEY = Symbol('resource-appearance-context')

export interface ResourceAppearanceContext {
	readonly current: ReadonlyMap<string, SavedAppearance>
	readonly session: ReadonlyMap<string, Record<string, unknown>>
	/** Replaces one resource's session edits. An empty record drops them. */
	setSession: (componentName: string, visualizer: Record<string, unknown>) => void
}

/** The session's unsaved appearance edits, by component name, each shaped like a `visualizer` config. */
export const createSessionAppearance = () => {
	let edits = $state.raw<ReadonlyMap<string, Record<string, unknown>>>(new Map())

	return {
		get current(): ReadonlyMap<string, Record<string, unknown>> {
			return edits
		},
		/** Replaces one resource's edits. An empty record drops them. */
		set: (componentName: string, visualizer: Record<string, unknown>) => {
			const next = new Map(edits)
			if (Object.keys(visualizer).length === 0) next.delete(componentName)
			else next.set(componentName, visualizer)
			edits = next
		},
		clear: () => {
			edits = new Map()
		},
	}
}

/**
 * Resolves how each resource is drawn and writes it onto its frames, in every mode (see
 * `resolvedAppearanceByComponent`). Color is resolved by `useFrames`, which reads `current`.
 */
export const provideResourceAppearance = (partID: () => string): ResourceAppearanceContext => {
	const partConfig = usePartConfig()
	const environment = useEnvironment()
	const frames = useQuery(...FRAME_ENTITY_QUERY)
	const session = createSessionAppearance()

	// Edits are keyed by component name, so another part's components must not inherit them.
	$effect.pre(() => {
		partID()
		untrack(() => session.clear())
	})

	const current = $derived(
		resolvedAppearanceByComponent(
			partConfig.current.components,
			session.current,
			environment.current.mode
		)
	)

	$effect(() => {
		const byComponent = current
		const entities = frames.current

		untrack(() => {
			for (const entity of entities) applyFrameAppearance(entity, byComponent)
		})
	})

	const context: ResourceAppearanceContext = {
		get current() {
			return current
		},
		get session() {
			return session.current
		},
		setSession: session.set,
	}

	setContext(RESOURCE_APPEARANCE_CONTEXT_KEY, context)
	return context
}

export const useResourceAppearance = (): ResourceAppearanceContext =>
	getContext(RESOURCE_APPEARANCE_CONTEXT_KEY)
