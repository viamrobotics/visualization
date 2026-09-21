import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'

const FRAME_PATH_PREFIX = 'frame.'

const valueAtPath = (value: unknown, path: string[]): unknown => {
	let cursor = value

	for (const segment of path) {
		if (cursor === null || typeof cursor !== 'object') {
			return undefined
		}

		cursor = (cursor as Record<string, unknown>)[segment]
	}

	return cursor
}

/**
 * The frame fields a fragment variable still supplies for this component, as
 * paths relative to the frame such as `translation.y`.
 *
 * A path drops out once the part overrides it, matching the app's frame form:
 * a field is locked while its value is still the variable's, and an override in
 * the part config unlocks it. `effectiveFrame` is the frame after the part's
 * `fragment_mods` apply, `info.frame` the fragment's own.
 *
 * An entry with no `variablePaths` cannot answer, so every frame field is
 * reported locked when the fragment binds any variable. See `FragmentInfo`.
 */
export const lockedFrameFields = (
	info: FragmentInfo | undefined,
	effectiveFrame: unknown
): string[] => {
	if (info === undefined) {
		return []
	}

	if (info.variablePaths === undefined) {
		return Object.keys(info.variables).length > 0 ? [FRAME_PATH_PREFIX] : []
	}

	const locked: string[] = []

	for (const path of Object.keys(info.variablePaths)) {
		if (!path.startsWith(FRAME_PATH_PREFIX)) {
			continue
		}

		const framePath = path.slice(FRAME_PATH_PREFIX.length).split('.')
		if (valueAtPath(effectiveFrame, framePath) === valueAtPath(info.frame, framePath)) {
			locked.push(framePath.join('.'))
		}
	}

	return locked
}

/** Whether any fragment variable still governs this component's frame. */
export const isFrameVariableLocked = (
	info: FragmentInfo | undefined,
	effectiveFrame: unknown
): boolean => lockedFrameFields(info, effectiveFrame).length > 0
