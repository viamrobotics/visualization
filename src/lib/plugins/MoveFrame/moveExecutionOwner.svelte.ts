let movingFrame = $state<string | undefined>(undefined)

/**
 * The single frame whose move is currently running, across every open panel. `execute` goes out over
 * `DoCommand`, which carries no operation label, so RDK cancels nothing between panels.
 *
 * Module scope rather than Svelte context. This app sets `ssr = false` with `adapter-static`, so no
 * server request exists to share. The shipped `moveGizmoOwner` has the same shape, and moving either
 * to context is a decision the two should make together.
 */
export const moveExecutionOwner = {
	get movingFrame() {
		return movingFrame
	},
	/** Take the lock, or report that another panel holds it. */
	claim(frame: string): boolean {
		if (movingFrame !== undefined) return false
		movingFrame = frame
		return true
	},
	release(frame: string) {
		if (movingFrame === frame) movingFrame = undefined
	},
}
