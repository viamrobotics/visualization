import type { Frame } from '$lib/frame'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import type { FragmentConfig, FragmentImport } from '$lib/resolveFragmentImport'

import { resolveFragmentImport } from '$lib/resolveFragmentImport'

/** One entry of a `fragment_mods` list. */
export interface FragmentMods {
	fragment_id?: string
	prefix?: string
	mods?: unknown[]
}

const DEFAULT_TRANSLATION = { x: 0, y: 0, z: 0 } as const
const DEFAULT_ORIENTATION = { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } } as const

/**
 * Fills the frame fields a fragment may omit. The fragment schema applies no
 * defaults, because a default would overwrite a variable placeholder before the
 * variable is known. Ported from `toFragmentInfoFrame` in the app's 3D scene
 * route, which is the same normalization an embedded host performs.
 */
const normalizeFrame = (frame: Record<string, unknown>): Frame =>
	({
		...frame,
		translation: frame['translation'] ?? DEFAULT_TRANSLATION,
		orientation: frame['orientation'] ?? DEFAULT_ORIENTATION,
	}) as unknown as Frame

const componentsOf = (config: FragmentConfig): { name: string; frame?: Frame }[] => {
	const components = config['components']
	if (!Array.isArray(components)) {
		return []
	}

	return components.flatMap((component) => {
		if (component === null || typeof component !== 'object') {
			return []
		}

		const { name, frame } = component as Record<string, unknown>
		if (typeof name !== 'string') {
			return []
		}

		return [
			frame !== null && typeof frame === 'object'
				? { name, frame: normalizeFrame(frame as Record<string, unknown>) }
				: { name },
		]
	})
}

const asStrings = (variables: Record<string, unknown> | undefined): Record<string, string> => {
	const results: Record<string, string> = {}

	for (const [name, value] of Object.entries(variables ?? {})) {
		results[name] = String(value)
	}

	return results
}

/**
 * Every component the part's fragments provide, with the frame each resolves to
 * before the part's own `fragment_mods` apply.
 *
 * Mods are deliberately left to the caller. That split is the contract an
 * embedded host already follows: it supplies pre-mod fragment frames and the
 * visualizer applies the part's mods on top.
 *
 * A fragment with an unresolved variable contributes nothing, matching the
 * server, which returns that fragment with an error and no config rather than a
 * partially substituted one.
 */
export const resolveFragmentComponents = (
	fragmentImports: FragmentImport[],
	configsById: Map<string, FragmentConfig>
): Record<string, FragmentInfo> => {
	const results: Record<string, FragmentInfo> = {}

	for (const fragmentImport of fragmentImports) {
		if (fragmentImport.disabled) {
			continue
		}

		const resolved = resolveFragmentImport(fragmentImport, configsById)
		if (resolved.missingVariables.length > 0) {
			continue
		}

		const variables = asStrings(fragmentImport.variables)

		for (const { name, frame } of componentsOf(resolved.config)) {
			// The merge concatenates a nested fragment's components ahead of the
			// parent's, so a later entry is the outer one and wins the name.
			results[name] = frame
				? { id: fragmentImport.id, variables, frame }
				: { id: fragmentImport.id, variables }
		}
	}

	return results
}

/**
 * The component names a `fragment_mods` list targets, read from dot-notation mod
 * paths like `components.<name>.frame` or `components.<name>.attributes.*`.
 */
const moddedComponentNames = (mods: unknown[]): string[] => {
	const names: string[] = []

	for (const mod of mods) {
		if (!mod || typeof mod !== 'object') {
			continue
		}

		for (const operand of Object.values(mod as Record<string, unknown>)) {
			if (!operand || typeof operand !== 'object') {
				continue
			}

			for (const path of Object.keys(operand as Record<string, unknown>)) {
				const match = /^components\.([^.]+)/.exec(path)
				if (match) {
					names.push(match[1])
				}
			}
		}
	}

	return names
}

/**
 * Adds any component the part's `fragment_mods` target that `known` does not
 * already list, so a frame edit on it still routes to the fragment rather than
 * no-opping against the part's own `components`.
 *
 * Reachable when a fragment failed to resolve, since its mods outlive it in the
 * config. Entries in `known` win, as only they carry a frame.
 */
export const withModdedFragmentComponents = (
	known: Record<string, FragmentInfo>,
	fragmentMods: FragmentMods[],
	variablesByFragmentId: Record<string, Record<string, string>>
): Record<string, FragmentInfo> => {
	const results = { ...known }

	for (const { fragment_id: fragmentId, mods } of fragmentMods) {
		if (!fragmentId || !mods) {
			continue
		}

		for (const name of moddedComponentNames(mods)) {
			results[name] ??= {
				id: fragmentId,
				variables: variablesByFragmentId[fragmentId] ?? {},
			}
		}
	}

	return results
}
