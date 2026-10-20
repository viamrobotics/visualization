import type { Frame } from '$lib/frame'

type JsonObject = Record<string, unknown>

/** A `$set` or `$unset` entry of a `fragment_mods` list. */
export type FrameModOperation = Record<string, Record<string, unknown>>

const UNSET_VALUE = ''

const isJsonObject = (value: unknown): value is JsonObject =>
	value !== null && typeof value === 'object' && !Array.isArray(value)

const isEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

interface Diff {
	set: Record<string, unknown>
	unset: string[]
}

/**
 * Recurses to the narrowest changed leaf, treating an array as one value.
 *
 * Ported from `deepDiff` in the app's
 * `ui/src/lib/robot-config/fragment-overwrites/diff.ts`, which is what decides
 * that editing one number writes `…frame.translation.y` rather than replacing
 * the whole frame.
 */
const diffToLeaves = (
	original: JsonObject,
	modified: JsonObject,
	path: string[],
	diff: Diff
): void => {
	for (const [key, originalValue] of Object.entries(original)) {
		const nextPath = [...path, key]

		if (!(key in modified)) {
			diff.unset.push(nextPath.join('.'))
			continue
		}

		const modifiedValue = modified[key]

		if (isJsonObject(originalValue) && isJsonObject(modifiedValue)) {
			diffToLeaves(originalValue, modifiedValue, nextPath, diff)
			continue
		}

		if (!isEqual(originalValue, modifiedValue)) {
			diff.set[nextPath.join('.')] = modifiedValue
		}
	}

	for (const [key, modifiedValue] of Object.entries(modified)) {
		if (!(key in original)) {
			diff.set[[...path, key].join('.')] = modifiedValue
		}
	}
}

/**
 * The `fragment_mods` operations that carry `frame` from the fragment's own
 * version to the edited one.
 *
 * Writing only the changed leaves is what keeps a field the fragment binds to a
 * variable bound. Replacing `components.<name>.frame` wholesale would bake the
 * variable's current value into the part config and break the binding.
 *
 * With no base frame there is nothing to diff against, so the whole frame is
 * set at once, matching what the app writes when a fragment component has no
 * frame yet.
 */
export const frameModOperations = (
	componentName: string,
	baseFrame: Frame | undefined,
	nextFrame: Frame
): FrameModOperation[] => {
	const framePath = `components.${componentName}.frame`

	if (baseFrame === undefined) {
		return [{ ['$set']: { [framePath]: nextFrame } }]
	}

	const diff: Diff = { set: {}, unset: [] }
	diffToLeaves(
		baseFrame as unknown as JsonObject,
		nextFrame as unknown as JsonObject,
		[framePath],
		diff
	)

	const operations: FrameModOperation[] = []

	if (Object.keys(diff.set).length > 0) {
		operations.push({ ['$set']: diff.set })
	}

	if (diff.unset.length > 0) {
		operations.push({
			['$unset']: Object.fromEntries(diff.unset.map((path) => [path, UNSET_VALUE])),
		})
	}

	return operations
}

/**
 * Replaces every operation addressing this component's frame with `operations`.
 *
 * Ported from `mergeFragmentMod` in the app's `fragment-mod.ts`: prior arguments
 * under the path prefix are dropped, an operation left with none is discarded,
 * and the replacements are appended. Editing in place instead would leave stale
 * patches that still apply, and array order decides which of the two wins.
 */
export const replaceFrameMods = (
	mods: JsonObject[],
	componentName: string,
	operations: FrameModOperation[]
): JsonObject[] => {
	const framePath = `components.${componentName}.frame`

	const kept = mods.flatMap((mod) => {
		const pruned: JsonObject = {}
		let hasArguments = false

		for (const [operator, operand] of Object.entries(mod)) {
			if (!isJsonObject(operand)) {
				pruned[operator] = operand
				hasArguments = true
				continue
			}

			const remaining = Object.entries(operand).filter(([path]) => !path.startsWith(framePath))
			if (remaining.length === 0) {
				continue
			}

			pruned[operator] = Object.fromEntries(remaining)
			hasArguments = true
		}

		return hasArguments ? [pruned] : []
	})

	return [...kept, ...operations]
}
