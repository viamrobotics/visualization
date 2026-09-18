import { trait } from 'koota'

import type { LineMeasure, PlaneAxis } from './gizmos'

/**
 * Present on a gizmo while the user is still placing it. A pending gizmo is
 * already a real entity so it renders live, but it is destroyed rather than kept
 * if the tool unmounts or the user cancels.
 *
 * The `Gizmo` marker itself lives in `$lib/ecs/traits` — see the comment there.
 */
export const PendingGizmo = trait()

/**
 * A reference plane. Its normal is +Z in the entity's local frame, so the world
 * plane it lies in comes from the entity's `Matrix`. Dimensions are mm, like
 * every other geometry trait, and convert at render.
 */
export const ReferencePlane = trait({ width: 500, height: 500, axis: 'xy' as PlaneAxis })

/** Renders distance labels along a polyline gizmo. */
export const PolylineMeasure = trait(() => ({ mode: 'segment' as Exclude<LineMeasure, 'none'> }))

/**
 * A three-point angle measurement. The interior angle is measured at the middle
 * vertex of the entity's `LinePositions`, which holds exactly three points.
 */
export const AngleMeasure = trait()
