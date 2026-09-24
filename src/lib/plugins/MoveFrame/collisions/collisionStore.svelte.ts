/** One intersecting pair, resolved to display names when it was detected. */
export interface CollisionReport {
	a: string
	b: string
	/**
	 * True when either side is a ghost of a staged move — the pair describes
	 * where the move would end up rather than where the scene is now.
	 */
	staged: boolean
}

let reports = $state.raw<CollisionReport[]>([])

/**
 * The collisions the detector last found, shared across every open move panel.
 *
 * A module-scope store rather than context, for the same reason as
 * `moveGizmoOwner`: several panels can be open at once and they all read the
 * same result, while the detector that writes it lives under `<World>` — a
 * different branch of the tree entirely, so context could not reach both.
 *
 * `$state.raw` because the array is replaced wholesale on every detection pass.
 */
export const collisionReports = {
	get current() {
		return reports
	},
	set(next: CollisionReport[]) {
		reports = next
	},
	clear() {
		reports = []
	},
}
