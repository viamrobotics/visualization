import { relation } from 'koota'

/**
 * Ghost → the entity it mirrors. `exclusive: true` because a ghost copies
 * exactly one source.
 *
 * Ghosts deliberately carry no `Name` and no `ChildOf`, which keeps them out of
 * the hierarchy tree, the frame system and the world-matrix system. That also
 * leaves them with no way to answer "which arm does this belong to", which the
 * collision check needs in order to put a ghost in the same collision group as
 * the thing it stands in for. This relation is that link, and it is invisible
 * to every system that keys on `ChildOf`.
 */
export const GhostOf = relation({ exclusive: true })
