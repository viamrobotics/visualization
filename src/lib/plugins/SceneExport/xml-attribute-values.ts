const XML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;',
}

/** `text`, safe inside a double-quoted XML attribute. */
export const xmlText = (text: string): string =>
	text.replaceAll(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character)

/** Micrometres and microradians, finer than any sim resolves a pose. */
const DECIMALS = 6

/**
 * Poses and lengths as a space-separated attribute. Rounds to fixed decimals, which strips float
 * noise and never writes `-0`. Not for mass properties: a small link's inertia rounds to zero.
 */
export const xmlNumbers = (...values: number[]): string =>
	values.map((value) => String(Number(value.toFixed(DECIMALS)) + 0)).join(' ')

/** Enough to keep a small link's inertia, around 1e-7 kg·m², from rounding to zero. */
const SIGNIFICANT_DIGITS = 6

/** Mass properties as a space-separated attribute, rounded to significant digits, not decimals. */
export const xmlSignificant = (...values: number[]): string =>
	values.map((value) => String(Number(value.toPrecision(SIGNIFICANT_DIGITS)) + 0)).join(' ')
