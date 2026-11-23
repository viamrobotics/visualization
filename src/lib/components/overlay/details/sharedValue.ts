/** Marks a field whose value differs across the selected entities. */
export const MIXED: unique symbol = Symbol('mixed')

/** A field's value across a selection: the one value every entity holds, or `MIXED`. */
export type Shared<TValue> = TValue | typeof MIXED

/** What a mixed field shows. The inputs are too narrow for a word. */
export const MIXED_TEXT = '-'

/**
 * How far apart two numbers may be and still read as one value. Poses come from
 * decomposing matrices, so two frames placed at the same x differ in the last bits.
 */
const NUMBER_TOLERANCE = 1e-6

/** Whether two numbers are equal within the decomposition noise of a matrix round trip. */
export const isNearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) <= NUMBER_TOLERANCE

/**
 * The value every entry holds, or `MIXED` when any two differ.
 *
 * @param values One entry per selected entity. A selection is never empty, so neither is this.
 */
export const sharedValue = <TValue>(
	values: readonly TValue[],
	isEqual: (a: TValue, b: TValue) => boolean = Object.is
): Shared<TValue> => {
	const [first, ...rest] = values
	return rest.every((value) => isEqual(first as TValue, value)) ? (first as TValue) : MIXED
}

/** `sharedValue` for numbers, comparing within the matrix decomposition tolerance. */
export const sharedNumber = (values: readonly number[]): Shared<number> =>
	sharedValue(values, isNearlyEqual)

/**
 * The number a Tweakpane input is handed for a shared field. Tweakpane has no mixed
 * state, so a mixed field passes `NaN` and `formatSharedNumber` shows it as a dash.
 */
export const toInputNumber = (value: Shared<number>): number => (value === MIXED ? Number.NaN : value)

/**
 * Formats a field for display, showing `MIXED_TEXT` for a mixed field or for the `NaN`
 * that `toInputNumber` hands Tweakpane in its place.
 */
export const formatSharedNumber = (value: Shared<number>, fractionDigits = 2): string =>
	value === MIXED || Number.isNaN(value) ? MIXED_TEXT : value.toFixed(fractionDigits)

/** Fewest decimals a Tweakpane number input shows, matching its default formatter. */
const MIN_INPUT_DECIMALS = 2
/** Most decimals Tweakpane's default formatter reads off a value. */
const MAX_INPUT_DECIMALS = 10

/**
 * The `format` for a Tweakpane number input that may hold a mixed field. Passing any
 * `format` replaces Tweakpane's default, so this keeps its precision: the value's own
 * decimals, at least two. `NaN`, from `toInputNumber`, shows as `MIXED_TEXT`.
 */
export const formatInputNumber = (value: number): string => {
	if (Number.isNaN(value)) return MIXED_TEXT

	const decimals = value.toFixed(MAX_INPUT_DECIMALS).split('.')[1]?.replace(/0+$/, '').length ?? 0
	return value.toFixed(Math.max(decimals, MIN_INPUT_DECIMALS))
}

/**
 * The axes of `next` that differ from what the input showed, as a patch. Tweakpane's
 * `Point` reports every axis on each change, and a mixed axis comes back as the `NaN`
 * it was handed, so only the axes the user touched survive.
 */
export const changedAxes = <TKey extends string>(
	shown: Readonly<Record<TKey, number>>,
	next: Readonly<Record<TKey, number>>
): Partial<Record<TKey, number>> => {
	const patch: Partial<Record<TKey, number>> = {}
	for (const key of Object.keys(next) as TKey[]) {
		const value = next[key]
		if (!Object.is(value, shown[key]) && !Number.isNaN(value)) patch[key] = value
	}
	return patch
}
