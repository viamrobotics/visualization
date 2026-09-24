/**
 * The red an intersecting collider is drawn in.
 *
 * A literal hex rather than a design token, for the same reason as
 * `MOVE_GHOST_COLOR`: these are scene materials, not UI chrome, and nothing
 * here goes through Tailwind. Chosen to read as an alarm against both the
 * amber/cyan resource palette and the ghost green.
 */
export const COLLISION_COLOR = '#e4444c'
