/**
 * Rapier collision-group filtering for the collision check.
 *
 * Rapier packs an `InteractionGroups` into one u32: the upper 16 bits are the
 * groups a collider *belongs to*, the lower 16 the groups it *tests against*.
 * Two colliders are considered only when each one's membership intersects the
 * other's filter. That test runs in the broad phase, so an excluded pair costs
 * nothing — it never reaches narrow phase at all.
 *
 * The scene is partitioned so nothing tests against its own group. An arm's link
 * colliders overlap at every joint by design, and the environment is full of scenery
 * resting on scenery. Reporting either would bury real hits under permanent noise. Each
 * arm takes its own bit, everything unowned shares the environment bit, and every group
 * filters itself out.
 *
 * What survives is exactly the interesting set: an arm against the environment,
 * and an arm against a different arm.
 *
 * The consequence is deliberate: one arm folding into itself is never reported.
 * Self-collision is the motion service's job — it plans against the arm's own
 * kinematics server-side. What this view uniquely shows is the arm hitting
 * something the world state didn't know about.
 */

/** Colliders with no owning arm: static obstacles, world-state geometry, dropped files. */
export const ENVIRONMENT_BIT = 0

/** Rapier gives 16 membership bits. Bit 0 is the environment, so 15 arms fit. */
const MAX_BIT = 15

const ALL_BITS = 0xff_ff

/**
 * Pack membership and filter halves into Rapier's `InteractionGroups` u32.
 *
 * `>>> 0` keeps the result unsigned — JS bitwise operators return a signed
 * int32, and a membership in bit 15 would otherwise arrive negative.
 */
export const interactionGroups = (memberships: number, filter: number): number =>
	(((memberships & ALL_BITS) << 16) | (filter & ALL_BITS)) >>> 0

/**
 * Assign each arm its own group bit, in the order given, starting at 1.
 *
 * Arms past the 15th share the last bit and stop testing against each other. A
 * cell that large isn't worth the complexity, and the degradation is quiet
 * under-reporting rather than a false alarm.
 */
export const assignArmBits = (armNames: readonly string[]): Map<string, number> => {
	const bits = new Map<string, number>()
	let next = ENVIRONMENT_BIT + 1
	for (const name of armNames) {
		if (bits.has(name)) continue
		bits.set(name, next)
		if (next < MAX_BIT) next += 1
	}
	return bits
}

/**
 * The interaction groups for a collider owned by the arm holding `bit`, or by
 * the environment when `bit` is `ENVIRONMENT_BIT`.
 *
 * Every group tests against every group but its own. For an arm that means it
 * sees the environment and other arms, never its own links.
 *
 * The environment is no exception, and that is the whole point. A real scene is full of
 * furniture resting on furniture, such as a fixture bolted to a table, a table on the
 * floor, or a conveyor on its stand. All of it touches by design and none of it is a
 * collision anyone wants reported. Left in, those pairs swamp the list and paint half
 * the scene red. Filtering them at the broad phase costs nothing and leaves only the
 * pairs that involve something that moves.
 *
 * The trade is that two static obstacles overlapping is no longer surfaced.
 * That is a world-state modelling error rather than a motion hazard, and this
 * panel is about whether a move is safe.
 */
export const groupsForBit = (bit: number): number => {
	const membership = 1 << bit
	return interactionGroups(membership, ALL_BITS & ~membership)
}
