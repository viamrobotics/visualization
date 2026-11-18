import type { Quaternion } from 'three'

// Re-deriving an unchanged orientation leaves the quaternion dot product a rounding error short
// of 1, which `angleTo`'s acos magnifies to up to about 1e-7 rad. A real turn onto a surface is
// orders of magnitude past this.
const MIN_TURN_RADIANS = 1e-5

/** Whether `to` is turned from `from` by more than rounding noise. */
export const isVisibleTurn = (from: Quaternion, to: Quaternion): boolean =>
	from.angleTo(to) > MIN_TURN_RADIANS
