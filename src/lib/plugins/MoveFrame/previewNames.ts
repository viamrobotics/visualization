const PREFIX = 'preview:'
const SAVED_POSE_PREFIX = 'saved-pose:'

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
 * The name a saved pose's ghost of `frameName` carries. Scoped by saver, since two savers of the
 * same arm can be shown at once. Resource names cannot contain `:`, so the saver ends at the first.
 */
export const savedPoseName = (saverName: string, frameName: string): string =>
	`${SAVED_POSE_PREFIX}${saverName}:${frameName}`

/**
 * The live frame a ghost name mirrors, or the name unchanged when it is already a live one.
 * Read rather than parsed: the prefixes are this module's own, not something RDK wrote.
 */
export const liveFrameName = (name: string): string => {
	if (name.startsWith(PREFIX)) return name.slice(PREFIX.length)
	if (!name.startsWith(SAVED_POSE_PREFIX)) return name

	const scoped = name.slice(SAVED_POSE_PREFIX.length)
	return scoped.slice(scoped.indexOf(':') + 1)
}
