const PREFIX = 'preview:'

/**
 * The name a ghost of `frameName` carries.
 *
 * A preview ghost is a second frame system laid over the live one, so its frames carry the live
 * names they mirror and would be captured by `resolveOrphans` as the live parents of live frames.
 * The prefix is what keeps the two apart, and it lives here so the ghost writer and the collision
 * panel cannot disagree about it.
 */
export const previewName = (frameName: string): string => `${PREFIX}${frameName}`

/**
 * The live frame a preview name mirrors, or the name unchanged when it is already a live one.
 * Read rather than parsed: the prefix is this module's own, not something RDK wrote.
 */
export const liveFrameName = (name: string): string =>
	name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name
