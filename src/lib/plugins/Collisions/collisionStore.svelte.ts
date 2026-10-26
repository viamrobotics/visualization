import { untrack } from 'svelte'

import type { CollisionReport } from './collisionReport'

let reports = $state.raw<CollisionReport[]>([])
let pluginCount = $state(0)

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
	/** Whether a `Collisions` plugin is mounted. Without one nothing ever fills this store. */
	get isAvailable() {
		return pluginCount > 0
	},
	/** Marks a `Collisions` plugin as mounted until the returned release is called. */
	register(): () => void {
		// Called from an effect. Reading the count there would make the effect depend on it and re-run on its own write.
		untrack(() => (pluginCount += 1))
		return () => untrack(() => (pluginCount -= 1))
	},
	set(next: CollisionReport[]) {
		reports = next
	},
	clear() {
		reports = []
	},
}
