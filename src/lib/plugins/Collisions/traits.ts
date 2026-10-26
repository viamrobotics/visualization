import { trait } from 'koota'

/**
 * Marks an entity standing for one intersecting pair. It has a `Name` so the world tree can list
 * it, `CollidesWith` edges to its two sides, and no scene object behind it.
 *
 * `staged` is true when the pair describes where a staged move would end up rather than where the
 * scene is now. `depth` is how far the shapes interpenetrate and `x`, `y`, `z` where, all in metres.
 */
export const Collision = trait({ staged: false, depth: 0, x: 0, y: 0, z: 0 })
