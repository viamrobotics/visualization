import type { Keybinding } from './catalog'

const ARROW_SYMBOLS: Record<string, string> = {
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
}

/**
 * Apple keyboards label the modifiers with symbols and print them unseparated, so a combo
 * reads `⌘⇧Z` there and `Ctrl+Shift+Z` everywhere else.
 */
const isAppleDevice = () => /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

/** A single key as it should be printed. `w` reads as `W`, `arrowup` as `↑`. */
export const formatKey = (key: string): string => {
	return ARROW_SYMBOLS[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}

/** The keys of a binding, in press order, before any of them are printed. */
const toTokens = (binding: Keybinding): readonly string[] => {
	if (binding.kind === 'fixed') return binding.combo
	if (binding.kind === 'hotkey' && binding.shift) return ['Shift', binding.key]
	return [binding.key]
}

/**
 * The printed keys of a binding, one entry per key, for rendering a chip each.
 *
 * `formatKeybinding` prints the same keys as one string. Use that where markup will not
 * fit, such as an attribute.
 */
export const keybindingParts = (binding: Keybinding): string[] => {
	const apple = isAppleDevice()

	return toTokens(binding).map((token) => {
		if (token === 'Mod') return apple ? '⌘' : 'Ctrl'
		if (token === 'Shift') return apple ? '⇧' : 'Shift'
		return formatKey(token)
	})
}

/** A binding as one run of text. */
export const formatKeybinding = (binding: Keybinding): string => {
	return keybindingParts(binding).join(isAppleDevice() ? '' : '+')
}
