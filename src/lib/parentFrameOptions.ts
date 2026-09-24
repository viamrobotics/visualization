import type { Transform } from '$lib/geometry'

const WORLD = 'world'

export interface FragmentComponent {
	name: string
	/**
	 * The parent the fragment's own frame declares, when the app knows it. A
	 * component mapped from a `fragment_mods` path alone (a nested fragment
	 * provides it, so `getFragment` never surfaced its frame) has no parent here,
	 * and stays out of the descendant walk below.
	 */
	parent: string | undefined
}

interface ParentFrameOptionsInput {
	/**
	 * Every frame the app knows about: the machine's frame system merged with the
	 * part config (see `useFrames`). The frame system is the authority on what a
	 * frame may be parented to — the RDK only admits components that declare a
	 * `frame`, and it admits them all, including ones the part config never
	 * enumerates (fragment-provided components, remote parts).
	 */
	frames: Transform[]
	/**
	 * Components a fragment provides. A fragment component with no `$set` mod
	 * isn't in `frames` while offline, but the fragment still supplies its frame,
	 * so it renders in the scene and is a valid parent. Online it's in `frames`
	 * too, and that entry wins — it carries the parent the machine resolved.
	 */
	fragmentComponents: FragmentComponent[]
	/** Frames deleted locally or removed by a fragment `$unset`. */
	unsetFrameNames: string[]
	/** The frame being reparented. */
	componentName: string | undefined
}

/**
 * The frames `componentName` may be reparented to, `world` first and the rest
 * alphabetical.
 *
 * Excludes the frame itself and its descendants: parenting a frame under its
 * own subtree makes a `ChildOf` cycle, which loops `recomputeWorldMatrix`
 * forever. Descendants are walked over the full merged frame set rather than
 * the part config alone, so a subtree the config doesn't enumerate can't slip
 * through as a selectable parent.
 *
 * One descendant can still slip through: a fragment component whose parent
 * nothing has told us (see `FragmentComponent.parent`). It has no edge to walk,
 * so it stays selectable even when it sits under `componentName`. Picking it
 * writes a cycle the RDK rejects as an unlinked part.
 */
export const parentFrameOptions = ({
	frames,
	fragmentComponents,
	unsetFrameNames,
	componentName,
}: ParentFrameOptionsInput): string[] => {
	const unset = new Set(unsetFrameNames)
	const options = new Set<string>()
	const childNames = new Map<string, string[]>()

	const link = (name: string, parent: string | undefined) => {
		if (unset.has(name)) return

		options.add(name)

		if (parent === undefined) return

		const children = childNames.get(parent)
		if (children) {
			children.push(name)
		} else {
			childNames.set(parent, [name])
		}
	}

	const framed = new Set<string>()
	for (const frame of frames) {
		framed.add(frame.referenceFrame)
		link(frame.referenceFrame, frame.poseInObserverFrame?.referenceFrame)
	}

	for (const { name, parent } of fragmentComponents) {
		// A frame the machine or a `$set` mod already reported is the resolved one. The
		// fragment's base parent may be stale against it.
		if (framed.has(name)) continue

		link(name, parent)
	}

	/**
	 * `seen` guards the walk against a cycle already present in the frame data —
	 * an edit mid-flight, or a machine the RDK reported as unlinked.
	 */
	const seen = new Set<string>()
	const queue = componentName ? [componentName] : []
	while (queue.length > 0) {
		const name = queue.shift()
		if (name === undefined || seen.has(name)) continue

		seen.add(name)
		options.delete(name)
		queue.push(...(childNames.get(name) ?? []))
	}

	// The machine's live frame system reports `world` as an explicit frame, so it
	// may already be in `options`. Remove it before prepending so it only appears once.
	options.delete(WORLD)

	return [WORLD, ...[...options].toSorted()]
}
