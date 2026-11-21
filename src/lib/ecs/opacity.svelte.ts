import type { Entity } from 'koota'

import { dimOpacity } from './dimmedAppearance'
import { Dimmed, Opacity, OpacityOverride } from './traits'
import { useTag } from './useTag.svelte'
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
 * source's, and a `Dimmed` entity's result is scaled by `DIMMED_OPACITY`.
 *
 * @see useOpacity for the reactive form.
 */
export const resolveOpacity = (entity: Entity): number => {
	const opacity = entity.get(OpacityOverride) ?? entity.get(Opacity) ?? DEFAULT_OPACITY
	return entity.has(Dimmed) ? dimOpacity(opacity) : opacity
}

/** `resolveOpacity` as a reactive box, for a component rendering one entity. */
export const useOpacity = (target: () => Entity | undefined): { readonly current: number } => {
	const override = useTrait(target, OpacityOverride)
	const source = useTrait(target, Opacity)
	const dimmed = useTag(target, Dimmed)

	return {
		get current() {
			const opacity = override.current ?? source.current ?? DEFAULT_OPACITY
			return dimmed.current ? dimOpacity(opacity) : opacity
		},
	}
}
