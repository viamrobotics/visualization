import type { Frame } from '$lib/frame'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'

type JsonObject = Record<string, unknown>

export interface ComponentFramesConfig {
	components?: { name: string; frame?: Frame }[]
	fragment_mods?: {
		fragment_id: string
		/** Which import the entry belongs to, when the part imports one fragment more than once. */
		prefix?: string
		mods: JsonObject[]
	}[]
}

export interface ComponentFrames {
	/**
	 * Frames the part authors: a component's own `frame`, and any frame a
	 * `fragment_mods` entry touched. A frame edit lands in one of those two
	 * wherever it was made, so these carry unsaved edits and outrank the
	 * machine's frame system while building.
	 */
	frames: Map<string, Frame>
	/**
	 * Frames a fragment supplies untouched by the part. The app does not expand
	 * a fragment variable the way the server does, so a rebuilt pose can differ
	 * from the one the machine resolved. These fill in for a frame the machine
	 * has not reported rather than overriding one it has.
	 */
	fragmentFrames: Map<string, Frame>
	/** Components the config leaves with no frame, including one a `$unset` mod removed. */
	unsetFrameNames: Set<string>
	/**
	 * Components a `fragment_mods` patch addresses beneath a frame that is not
	 * there to patch, which is what a fragment that failed to resolve leaves
	 * behind. The frame is real and the component is not frameless. Only its
	 * pose has to come from the machine.
	 */
	unresolvedFrameNames: Set<string>
}

const getRecord = (value: unknown): JsonObject | undefined =>
	value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as JsonObject)
		: undefined

const setAtPath = (target: JsonObject, path: string[], value: unknown): void => {
	const leaf = path.at(-1)
	if (leaf === undefined) {
		return
	}

	let cursor = target
	for (const segment of path.slice(0, -1)) {
		const existing = getRecord(cursor[segment])
		if (existing === undefined) {
			const created: JsonObject = {}
			cursor[segment] = created
			cursor = created
		} else {
			cursor = existing
		}
	}

	cursor[leaf] = value
}

const deleteAtPath = (target: JsonObject, path: string[]): void => {
	const leaf = path.at(-1)
	if (leaf === undefined) {
		return
	}

	let cursor = target
	for (const segment of path.slice(0, -1)) {
		const existing = getRecord(cursor[segment])
		if (existing === undefined) {
			return
		}
		cursor = existing
	}

	delete cursor[leaf]
}

interface FragmentFrameResolution {
	frame?: Frame
	/** Whether any mod touched the frame, making the part rather than the fragment its author. */
	isAuthored: boolean
	isUnset: boolean
	isUnresolved: boolean
}

/**
 * Replays one fragment's mods over the frame the fragment itself declares.
 *
 * `fragment_mods` address a frame two ways and both have to be honoured. A
 * `$set` of `components.<name>.frame` replaces it wholesale, which is what the
 * frame editor writes. A `$set` or `$unset` of a path beneath it, such as
 * `components.<name>.frame.translation.y`, patches one field, which is what a
 * hand-written config usually holds. Reading only the first leaves a machine
 * framed entirely by a fragment looking frameless.
 */
const resolveFragmentFrame = (
	componentName: string,
	baseFrame: Frame | undefined,
	mods: JsonObject[]
): FragmentFrameResolution => {
	const framePath = `components.${componentName}.frame`
	const patchPrefix = `${framePath}.`

	let frame = baseFrame === undefined ? undefined : structuredClone(baseFrame)
	let isAuthored = false
	let isUnset = false
	let isUnresolved = false

	const patch = (path: string, apply: (target: JsonObject, segments: string[]) => void) => {
		if (frame === undefined) {
			isUnresolved = true
			return
		}

		apply(frame as unknown as JsonObject, path.slice(patchPrefix.length).split('.'))
	}

	for (const mod of mods) {
		for (const [operator, operand] of Object.entries(mod)) {
			const paths = getRecord(operand)
			if (paths === undefined) {
				continue
			}

			for (const [path, value] of Object.entries(paths)) {
				if (path !== framePath && !path.startsWith(patchPrefix)) {
					continue
				}

				if (operator === '$set') {
					if (path === framePath) {
						frame = structuredClone(value) as Frame
						isAuthored = true
						isUnset = false
						isUnresolved = false
					} else {
						patch(path, (target, segments) => setAtPath(target, segments, value))
						isAuthored ||= frame !== undefined
					}
				} else if (operator === '$unset') {
					if (path === framePath) {
						frame = undefined
						isAuthored = false
						isUnset = true
						isUnresolved = false
					} else {
						patch(path, deleteAtPath)
						isAuthored ||= frame !== undefined
					}
				}
			}
		}
	}

	return { frame, isAuthored, isUnset, isUnresolved }
}

/**
 * The frame every component the part knows about resolves to, split by whether
 * the part config authors it or a fragment supplies it.
 *
 * Fragment-provided components never appear in `config.components`, so their
 * frames come from `fragmentInfo` and the part's `fragment_mods` instead.
 */
export const resolveComponentFrames = (
	config: ComponentFramesConfig,
	fragmentInfo: Record<string, FragmentInfo>
): ComponentFrames => {
	const frames = new Map<string, Frame>()
	const fragmentFrames = new Map<string, Frame>()
	const unsetFrameNames = new Set<string>()
	const unresolvedFrameNames = new Set<string>()

	for (const component of config.components ?? []) {
		if (component.frame) {
			frames.set(component.name, component.frame)
		} else {
			unsetFrameNames.add(component.name)
		}
	}

	for (const [componentName, info] of Object.entries(fragmentInfo)) {
		// Every entry sharing a fragment id, not the first. A part that imports one
		// fragment twice writes an entry per import, and the server aggregates them
		// before applying, so reading one entry drops the other import's mods.
		const mods =
			config.fragment_mods
				?.filter((mod) => mod.fragment_id === info.id)
				.flatMap(({ mods }) => mods) ?? []
		const { frame, isAuthored, isUnset, isUnresolved } = resolveFragmentFrame(
			componentName,
			info.frame,
			mods
		)

		if (frame) {
			unsetFrameNames.delete(componentName)

			if (isAuthored) {
				frames.set(componentName, frame)
			} else {
				fragmentFrames.set(componentName, frame)
			}

			continue
		}

		if (isUnset) {
			frames.delete(componentName)
			unsetFrameNames.add(componentName)
			continue
		}

		if (isUnresolved) {
			unsetFrameNames.delete(componentName)
			unresolvedFrameNames.add(componentName)
		}
	}

	return { frames, fragmentFrames, unsetFrameNames, unresolvedFrameNames }
}

/** Every resolved frame in one map, an authored frame winning a name collision. */
export const mergedComponentFrames = ({
	frames,
	fragmentFrames,
}: ComponentFrames): Map<string, Frame> => new Map([...fragmentFrames, ...frames])
