import type { JsonObject } from '@bufbuild/protobuf'

import { Struct } from '@viamrobotics/sdk'
import { createAppQuery } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

import type { FragmentMods } from '$lib/fragmentComponents'
import type { Frame } from '$lib/frame'
import type { FragmentConfig, FragmentImport } from '$lib/resolveFragmentImport'

import { resolveFragmentComponents, withModdedFragmentComponents } from '$lib/fragmentComponents'
import { importsOf } from '$lib/resolveFragmentImport'

/**
 * What one fragment-provided component is worth knowing about.
 *
 * This is a contract, not a convenience shape. An embedded host builds this map
 * itself, so what it supplies decides what the scene can draw, and the fields
 * below say what that costs.
 */
export interface FragmentInfo {
	/**
	 * The fragment the **part imports**, never a fragment nested inside it.
	 * `fragment_mods` are keyed by the imported id, so a nested fragment's id
	 * here sends every frame edit to a fragment the part does not import and
	 * hides the mods that already exist.
	 */
	id: string
	/**
	 * The frame the fragment declares for the component, before the part's own
	 * `fragment_mods` patch it. Supply it whenever the fragment has one.
	 *
	 * Omitting it does not mean the component is frameless. It means the app
	 * cannot place the component from config alone, so it draws only where the
	 * machine's frame system reports it and vanishes from an offline scene. A
	 * `fragment_mods` patch of a path beneath the frame has nothing to patch
	 * either, so the patched pose is lost as well.
	 */
	frame?: Frame
	/** Fragment variables the part sets, for the UI that warns an edit may not stick. */
	variables: Record<string, string>
	/**
	 * Which of this component's config paths a fragment variable supplies, mapped
	 * to the variable's name. Paths are relative to the component, so a frame
	 * field reads `frame.translation.y` and `attributes.host` is not one.
	 *
	 * Shaped to match the `paths` map of the app's `ResourceVariablePaths`, so an
	 * embedded host can pass the server's answer through unchanged.
	 *
	 * Undefined means the source cannot say, which is not the same as `{}`. An
	 * empty map asserts that nothing here is variable backed and frame editing is
	 * safe. Undefined falls back to locking a frame whenever the fragment binds
	 * any variable at all, since the alternative is letting an edit bake a
	 * variable's current value into the part config.
	 */
	variablePaths?: Record<string, string>
}

const key = Symbol('fragment-info-context')

interface FragmentInfoContext {
	/** componentName -> the fragment that provides it. */
	current: Record<string, FragmentInfo>
}

/**
 * Single source of truth for which components a fragment provides.
 *
 * Two sources, one contract. An embedded host already resolved this to render
 * its config editor and passes it as a prop, including the unsaved fragment
 * changes no query can see. Standalone derives it from `getRobotPart` and
 * `listMachineFragments`. Mode is fixed for the session (the prop is either
 * always defined or always undefined), mirroring `providePartConfig`.
 *
 * Whichever source answers, the result goes through
 * `withModdedFragmentComponents`, so a component named only by a
 * `fragment_mods` path still routes its edits to the fragment.
 *
 * Must be provided BEFORE `providePartConfig`, whose frame-edit routing
 * consumes `useFragmentInfo()` to choose part-frame vs fragment-mod writes.
 * That ordering is why the part config arrives here as a prop rather than from
 * `usePartConfig`.
 */
export const provideFragmentInfo = (
	partID: () => string,
	embeddedMap: () => Record<string, FragmentInfo> | undefined,
	embeddedPartConfig: () => Struct | undefined
) => {
	const embedded = $derived(embeddedMap())
	const standalone = $derived(embedded ? undefined : useStandaloneFragmentInfo(partID))

	const partConfigJSON = $derived(
		embedded ? structToJson(embeddedPartConfig()) : standalone?.partConfigJSON
	)

	const fragmentMods = $derived((partConfigJSON?.['fragment_mods'] ?? []) as FragmentMods[])

	const current = $derived(
		withModdedFragmentComponents(
			embedded ?? standalone?.fragmentComponents ?? {},
			fragmentMods,
			fragmentVariablesById(partConfigJSON)
		)
	)

	setContext<FragmentInfoContext>(key, {
		get current() {
			return current
		},
	})
}

export const useFragmentInfo = (): FragmentInfoContext => {
	return getContext<FragmentInfoContext>(key)
}

const structToJson = (config: Struct | undefined): JsonObject | undefined => {
	if (!config) {
		return undefined
	}

	try {
		return config.toJson() as JsonObject
	} catch {
		return undefined
	}
}

const importedFragments = (partConfigJSON: JsonObject | undefined): FragmentImport[] =>
	importsOf(partConfigJSON ?? {})

const fragmentVariablesById = (
	partConfigJSON: JsonObject | undefined
): Record<string, Record<string, string>> => {
	const results: Record<string, Record<string, string>> = {}

	for (const { id, variables } of importedFragments(partConfigJSON)) {
		const bound: Record<string, string> = {}
		for (const [name, value] of Object.entries(variables ?? {})) {
			bound[name] = String(value)
		}
		results[id] = bound
	}

	return results
}

interface StandaloneFragmentInfo {
	partConfigJSON: JsonObject | undefined
	fragmentComponents: Record<string, FragmentInfo>
}

const useStandaloneFragmentInfo = (partID: () => string): StandaloneFragmentInfo => {
	const partQuery = createAppQuery('getRobotPart', () => [partID()] as const, {
		refetchInterval: false,
	})

	const machineID = $derived(partQuery.data?.part?.robot ?? '')
	const partConfigJSON = $derived(structToJson(partQuery.data?.part?.robotConfig))

	/**
	 * Covers the fragments this part imports and every fragment nested inside
	 * them, which `getFragment` cannot: it answers with a fragment's stored
	 * config, where a nested fragment is an id and its components are absent.
	 *
	 * Scoped to the machine, so a fragment only a sibling part imports comes back
	 * here too. The walk starts from this part's own ids, which leaves those out.
	 */
	const machineFragmentsQuery = createAppQuery(
		'listMachineFragments',
		() => [machineID] as const,
		() => ({ enabled: machineID !== '' })
	)

	const fragmentConfigsById = $derived.by(() => {
		const configs = new Map<string, FragmentConfig>()

		for (const fragment of machineFragmentsQuery.data ?? []) {
			const config = structToJson(fragment.fragment)
			if (config) {
				configs.set(fragment.id, config as FragmentConfig)
			}
		}

		return configs
	})

	const fragmentComponents = $derived(
		resolveFragmentComponents(importedFragments(partConfigJSON), fragmentConfigsById)
	)

	return {
		get partConfigJSON() {
			return partConfigJSON
		},
		get fragmentComponents() {
			return fragmentComponents
		},
	}
}
