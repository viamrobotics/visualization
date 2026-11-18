import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'

const FRAME_PATH_PREFIX = 'frame.'

/**
 * Which of a component's frame fields a fragment variable still supplies.
 *
 * `unknown` is not `none`. It means the fragment binds variables and the source
 * could not say where they land, so the safe reading is that any field may be
 * one of them. See `FragmentInfo.variablePaths`.
 */
export type FrameVariableLock =
	| { kind: 'none' }
	| { kind: 'unknown' }
	| { kind: 'fields'; paths: string[] }

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
 * A field drops out of the lock once the part overrides it, matching the app's
 * frame form: a field is locked while its value is still the variable's, and an
 * override in the part config unlocks it.
 *
 * `effectiveFrame` is the frame after the part's `fragment_mods` apply, and
 * `info.frame` the fragment's own.
 */
export const frameVariableLock = (
	info: FragmentInfo | undefined,
	effectiveFrame: unknown
): FrameVariableLock => {
	if (info === undefined) {
		return { kind: 'none' }
	}

	if (info.variablePaths === undefined) {
		return Object.keys(info.variables).length > 0 ? { kind: 'unknown' } : { kind: 'none' }
	}

	const paths: string[] = []

	for (const path of Object.keys(info.variablePaths)) {
		if (!path.startsWith(FRAME_PATH_PREFIX)) {
			continue
		}

		const framePath = path.slice(FRAME_PATH_PREFIX.length).split('.')
		if (valueAtPath(effectiveFrame, framePath) === valueAtPath(info.frame, framePath)) {
			paths.push(framePath.join('.'))
		}
	}

	return paths.length > 0 ? { kind: 'fields', paths } : { kind: 'none' }
}

/** Whether any fragment variable still governs this component's frame. */
export const isFrameVariableLocked = (
	info: FragmentInfo | undefined,
	effectiveFrame: unknown
): boolean => frameVariableLock(info, effectiveFrame).kind !== 'none'
