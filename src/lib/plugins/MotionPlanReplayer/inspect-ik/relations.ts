import { relation } from 'koota'

/**
 * Members are the source, the set's root is the target, so destroying the root destroys the set —
 * the same shape as the replayer's `PartOfPlan`.
 *
 * Kept separate from `PartOfPlan` rather than reused: the replayer queries that relation every
 * scrub step to preserve user-edited display state, and inspection entities have no business
 * showing up in it.
 */
export const PartOfInspection = relation({ autoDestroy: 'source' })
