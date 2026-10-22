import type { SnapQuery, SnapResult } from './snapQuery'

import { pointSnap } from './pointSnap'
import { surfaceSnap } from './surfaceSnap'

/**
 * Where one pointer move of a translate drag snaps to. A key point within reach of the cursor wins
 * over the surface under it. Returns `null` when neither applies, which leaves the gizmo's own
 * position, increment snap included, in place.
 */
export const resolveSnap = (query: SnapQuery): SnapResult | null =>
	pointSnap(query) ?? surfaceSnap(query)
