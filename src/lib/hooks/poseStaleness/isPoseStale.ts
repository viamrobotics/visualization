/** Grace period on top of the poll period, so a reconnect blip stays quiet. */
export const STALE_AFTER_MS = 2000

/**
 * Structural, so `usePoses` can hand over its own entries untouched. This is
 * judged on the pose hot path, where a mapped array of every frame is rebuilt
 * on each arrival at up to 60fps.
 */
export interface PolledFrame {
	/** Only `dataUpdatedAt` is read: when this frame's last successful `getPose` landed, or 0. */
	query: { dataUpdatedAt: number }

	/** When this frame joined the polled set, in epoch ms. */
	joinedAt: number
}

/** Epoch milliseconds, except `interval`. */
export interface PoseFreshness {
	now: number

	pollingStartedAt: number

	/** Poll period in ms. Zero or negative means polling is manual or off. */
	interval: number

	frames: readonly PolledFrame[]
}

/**
 * Whether the scene is drawing poses older than the poll rate can explain.
 * A gap, not an error: a dropped connection disables the pose queries rather
 * than failing them, and a hung `getPose` never errors.
 *
 * The verdict is the newest answer from any frame that has had time to give one,
 * so one frame still answering keeps the scene quiet. `getPose` resolves through
 * the frame system's `CurrentInputs`, which polls every input-enabled component
 * before transforming anything, so poses fail together or succeed together and
 * one live answer means the frame system is up. A single frame's own trouble is
 * reported on its row in the tree instead.
 *
 * Whether a frame has had time to answer is per frame, which is what keeps one
 * frame joining a wedged scene from restarting the reckoning for every other
 * frame and hiding a real stall for as long as frames kept arriving.
 */
export const isPoseStale = ({
	now,
	pollingStartedAt,
	interval,
	frames,
}: PoseFreshness): boolean => {
	if (interval <= 0) {
		return false
	}

	/** The longest silence a working machine can produce, so anything past it is a stall. */
	const toleratedGap = interval + STALE_AFTER_MS

	// Floored by `pollingStartedAt` so a part that just connected, or was
	// revisited carrying a cached pose from its last session, isn't blamed.
	let latest = pollingStartedAt
	let answerable = 0

	for (const { query, joinedAt } of frames) {
		// A frame that joined within the tolerated gap has not had time to answer
		// through any fault of the machine, so it neither counts against it nor
		// speaks for it.
		if (now - joinedAt <= toleratedGap) continue

		answerable += 1
		latest = Math.max(latest, query.dataUpdatedAt)
	}

	return answerable > 0 && now - latest > toleratedGap
}
