/**
 * The green every part of a staged move is drawn in — the ghosted subtree, the
 * travel line, and the triad at the goal. One value so the pieces of a single
 * affordance can't drift apart.
 *
 * A literal hex rather than a design token because these are scene materials,
 * not UI chrome: nothing here goes through Tailwind.
 */
export const MOVE_GHOST_COLOR = '#37a06f'
