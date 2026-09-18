/** Grace period on top of the poll period, so a reconnect blip stays quiet. */
export const STALE_AFTER_MS = 2000

/** Epoch milliseconds throughout. */
export interface PolledFrame {
	/** When this frame's last successful `getPose` landed; 0 before the first one. */
	lastPoseAt: number

	/** When this frame joined the polled set. */
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
 * Judged per frame rather than over one scene-wide timestamp. A single frame
 * joining is not evidence the machine is answering, and treating it as though it
 * were let one frame entering a wedged scene restart the reckoning for every
 * other frame, hiding a real stall for as long as frames kept arriving.
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

	// A frame that joined within the tolerated gap has not had time to answer
	// through any fault of the machine, so it neither counts against it nor
	// speaks for it.
	const answerable = frames.filter(({ joinedAt }) => now - joinedAt > toleratedGap)

	if (answerable.length === 0) {
		return false
	}

	// Floored by `pollingStartedAt` so a part that just connected, or was
	// revisited carrying a cached pose from its last session, isn't blamed.
	let latest = pollingStartedAt
	for (const { lastPoseAt } of answerable) {
		latest = Math.max(latest, lastPoseAt)
	}

	return now - latest > toleratedGap
}
