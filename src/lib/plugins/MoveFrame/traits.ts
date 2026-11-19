import { trait } from 'koota'

/**
 * Marks a frame drawn from a planned trajectory or a saved pose rather than from where the machine
 * is. It sits in the hierarchy like any other frame, so nothing else can tell it apart, and the
 * collision panel needs to: a pair a ghost would hit is a warning about a move, not a report about
 * the present.
 */
export const PreviewGhost = trait(() => true)
