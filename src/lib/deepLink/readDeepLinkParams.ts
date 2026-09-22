/**
 * Every visualizer query parameter carries this prefix, so a host page's own
 * parameters never collide with ours. Shared with any future link formatter.
 */
const DEEP_LINK_PREFIX = 'viz.'

/** Un-prefixed key to its values, in the order they appeared in the URL. */
export type DeepLinkParams = ReadonlyMap<string, readonly string[]>

/**
 * Collects the `viz.`-prefixed entries of a query string and strips the prefix.
 * Every other entry is ignored. A repeated key collects its values in order, and
 * an empty or missing source yields an empty map.
 */
export const readDeepLinkParams = (source: string | URLSearchParams): DeepLinkParams => {
	const searchParams = typeof source === 'string' ? new URLSearchParams(source) : source
	const params = new Map<string, string[]>()

	for (const [key, value] of searchParams) {
		if (!key.startsWith(DEEP_LINK_PREFIX)) continue

		const unprefixedKey = key.slice(DEEP_LINK_PREFIX.length)
		if (unprefixedKey === '') continue

		const values = params.get(unprefixedKey)
		if (values) {
			values.push(value)
		} else {
			params.set(unprefixedKey, [value])
		}
	}

	return params
}
