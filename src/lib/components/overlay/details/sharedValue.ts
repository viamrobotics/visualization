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

/** Formats a read-only field for display, showing `MIXED_TEXT` for a mixed field. */
export const formatSharedNumber = (value: Shared<number>, fractionDigits = 2): string =>
	value === MIXED ? MIXED_TEXT : value.toFixed(fractionDigits)
