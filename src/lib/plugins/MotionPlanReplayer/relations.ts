import { relation } from 'koota'

/**
 * Members are the source, the plan root is the target. Destroying the plan
 * root cascades to destroy every member — the opposite direction from
 * Selection's `PointsCapturedBy` (autoDestroy: 'target'), since here we want
 * "destroy the group destroys its members", not "destroy a member destroys
 * the group".
 */
export const PartOfPlan = relation({ autoDestroy: 'source' })
