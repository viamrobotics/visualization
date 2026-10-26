import { relation } from 'koota'

/**
 * Collision pair entity → each of its two sides. `autoDestroy: 'source'` because a pair means
 * nothing once either side is gone, so destroying a collider destroys its pairs with it.
 */
export const CollidesWith = relation({ autoDestroy: 'source' })
