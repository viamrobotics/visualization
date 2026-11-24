/** How an orientation is edited: as an orientation vector, or as ZYX Euler angles. */
export type OrientationFormat = 'ov' | 'euler'

/**
 * The `PersistedState` key for the format the user last picked. Every orientation editor reads
 * the same key, so picking Euler in one keeps it for the others and across reloads.
 */
export const ORIENTATION_FORMAT_KEY = 'orientation-format'

/** Euler angles, until the user picks otherwise. */
export const DEFAULT_ORIENTATION_FORMAT: OrientationFormat = 'euler'
