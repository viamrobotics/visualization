import type { Entity } from 'koota'

import { Opacity, OpacityOverride } from './traits'
import { useTrait } from './useTrait.svelte'

/**
 * Alpha for an entity carrying neither trait. Colliders are the only things
 * that reach it — every other spawner writes `Opacity` — and they read as
 * translucent so the CAD model they wrap stays visible through them.
 */
export const DEFAULT_GEOMETRY_OPACITY = 0.5

/**
 * The alpha a renderer should draw `entity` at. The user's edit outranks the
 * source's.
 *
 * @see useOpacity for the reactive form.
 */
export const resolveOpacity = (entity: Entity): number =>
	entity.get(OpacityOverride) ?? entity.get(Opacity) ?? DEFAULT_GEOMETRY_OPACITY

/** `resolveOpacity` as a reactive box, for a component rendering one entity. */
export const useOpacity = (target: () => Entity | undefined): { readonly current: number } => {
	const override = useTrait(target, OpacityOverride)
	const source = useTrait(target, Opacity)

	return {
		get current() {
			return override.current ?? source.current ?? DEFAULT_GEOMETRY_OPACITY
		},
	}
}
