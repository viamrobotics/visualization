import { Color } from 'three'

/**
 * The factor a `Dimmed` entity's opacity is multiplied by, so an opaque one draws at 0.5.
 * Distinct from the 0.35 of a motion preview ghost, so the two never read alike.
 */
export const DIMMED_OPACITY = 0.5

/** How far a `Dimmed` entity's color moves toward `DIMMED_BLEND_TARGET`, from 0 to 1. */
const DIMMED_COLOR_BLEND = 0.5

/** `--color-gray-5` from `@viamrobotics/tailwind-config`. */
export const DIMMED_BLEND_TARGET = '#c5c6cc'

const blendTarget = new Color(DIMMED_BLEND_TARGET)

/** Blends `color` toward `gray-5` in place and returns it. */
export const dimColor = (color: Color): Color => color.lerp(blendTarget, DIMMED_COLOR_BLEND)

/**
 * Scales `opacity` by `DIMMED_OPACITY`. A translucent collider fades further, so it still reads
 * fainter than a focused collider at the same source opacity.
 */
export const dimOpacity = (opacity: number): number => opacity * DIMMED_OPACITY
