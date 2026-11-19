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

/** `values` as a space-separated attribute. Rounds away float noise and never writes `-0`. */
export const xmlNumbers = (...values: number[]): string =>
	values.map((value) => String(Number(value.toFixed(DECIMALS)) + 0)).join(' ')
