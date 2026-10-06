import type { Entity } from 'koota'

import type { SavedAppearance } from '$lib/resourceAppearance'

import { ownerOfInternalFrame } from '$lib/kinematicsFrames'

import { setOrAddTrait } from './setOrAddTrait'
import * as traits from './traits'

/** The part of a resource's appearance that reaches one of its frames. */
interface FrameAppearance {
	opacity?: number
	invisible?: boolean
	show_axes_helper?: boolean
}

/**
 * The appearance `entity` takes from its resource's config. A frame inside the resource, such as
 * an arm's link or an obstacle's shape, takes the resource's opacity and axes helper unless it
 * saves its own. Hiding is not inherited as a value: hiding the resource already hides what is
 * inside. Color is not here: `useFrames` resolves it with the resource's default color.
 */
const appearanceForFrame = (
	name: string,
	appearanceByComponent: ReadonlyMap<string, SavedAppearance>
): FrameAppearance => {
	const owner = ownerOfInternalFrame(name)
	if (owner === undefined) {
		const { opacity, invisible, show_axes_helper } = appearanceByComponent.get(name)?.own ?? {}
		return { opacity, invisible, show_axes_helper }
	}

	const saved = appearanceByComponent.get(owner)
	const own = saved?.frames.get(name.slice(owner.length + 1)) ?? {}
	return {
		opacity: own.opacity ?? saved?.own.opacity,
		invisible: own.invisible,
		show_axes_helper: own.show_axes_helper ?? saved?.own.show_axes_helper,
	}
}

const parseApplied = (key: string | undefined): FrameAppearance =>
	key ? (JSON.parse(key) as FrameAppearance) : {}

/**
 * Writes the appearance saved in its resource's config onto a frame entity, once per config
 * change. An edit made in the scene since, such as hiding the frame from the world tree, stays
 * until the config changes again. A key removed from the config puts the frame back to its
 * default.
 */
export const applyConfigAppearance = (
	entity: Entity,
	appearanceByComponent: ReadonlyMap<string, SavedAppearance>
): void => {
	const name = entity.get(traits.Name)
	if (name === undefined) return

	const next = appearanceForFrame(name, appearanceByComponent)
	const key = JSON.stringify(next)
	const appliedKey = entity.get(traits.AppliedConfigAppearance)?.key
	if (appliedKey === key) return
	const previous = parseApplied(appliedKey)

	if (next.opacity !== undefined) {
		setOrAddTrait(entity, traits.OpacityOverride, next.opacity)
	} else if (previous.opacity !== undefined) {
		// An override at the frame's own opacity, rather than none, so a respawn cannot restore the old one.
		setOrAddTrait(entity, traits.OpacityOverride, entity.get(traits.Opacity) ?? 1)
	}

	if (next.invisible !== previous.invisible) {
		if (next.invisible) entity.add(traits.Invisible)
		else entity.remove(traits.Invisible)
	}

	if (next.show_axes_helper !== previous.show_axes_helper) {
		if (next.show_axes_helper === false) entity.remove(traits.ShowAxesHelper)
		else entity.add(traits.ShowAxesHelper)
	}

	setOrAddTrait(entity, traits.AppliedConfigAppearance, { key })
}
