/**
 * Reads the `drawPort` query parameter, or undefined to let the draw service
 * plugin apply its own default.
 *
 * Parallel e2e workers each run their own draw server behind one shared dev
 * server, so the port cannot come from a compile-time define. It also lets a
 * running app be pointed at a second draw server without a rebuild.
 */
export const readDrawServicePortOverride = (search: string): string | undefined => {
	const override = new URLSearchParams(search).get('drawPort')
	return override !== null && /^\d+$/.test(override) ? override : undefined
}
