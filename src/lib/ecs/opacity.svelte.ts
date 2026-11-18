import type { Entity } from 'koota'

import { Opacity, OpacityOverride } from './traits'
import { useTrait } from './useTrait.svelte'

/** Alpha for an entity carrying neither trait. Anything meant to be translucent writes `Opacity`. */
export const DEFAULT_OPACITY = 1

/**
 * Alpha for geometry that wraps something the user still needs to see, such as
 * a collider around a CAD model or a box around a segmented object.
 */
export const TRANSLUCENT_GEOMETRY_OPACITY = 0.5

/**
 * The alpha a renderer should draw `entity` at. The user's edit outranks the
 * source's.
 *
 * @see useOpacity for the reactive form.
 */
export const resolveOpacity = (entity: Entity): number =>
	entity.get(OpacityOverride) ?? entity.get(Opacity) ?? DEFAULT_OPACITY

/** `resolveOpacity` as a reactive box, for a component rendering one entity. */
export const useOpacity = (target: () => Entity | undefined): { readonly current: number } => {
	const override = useTrait(target, OpacityOverride)
	const source = useTrait(target, Opacity)

	return {
		get current() {
			return override.current ?? source.current ?? DEFAULT_OPACITY
		},
	}
}
