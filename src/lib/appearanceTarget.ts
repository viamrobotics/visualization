import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { ownerOfInternalFrame } from '$lib/kinematicsFrames'

/** Where a frame's appearance is saved: its part component, and its id inside that component. */
export interface AppearanceTarget {
	component: PartComponent
	/** The id after `<name>:`, or undefined for the component's own frame. */
	frameId: string | undefined
}

/**
 * Where the frame `frameName` saves its appearance: on the part component it is, or on the part
 * component it sits inside, such as an obstacle owning its shapes. Undefined for a frame no part
 * component owns.
 */
export const appearanceTargetOf = (
	components: PartComponent[] | undefined,
	frameName: string | undefined
): AppearanceTarget | undefined => {
	if (frameName === undefined) return undefined

	const own = components?.find((component) => component.name === frameName)
	if (own) return { component: own, frameId: undefined }

	const owner = ownerOfInternalFrame(frameName)
	if (owner === undefined) return undefined
	const component = components?.find((candidate) => candidate.name === owner)
	return component ? { component, frameId: frameName.slice(owner.length + 1) } : undefined
}

/** Where any frame's appearance is kept by name: the component it is or sits inside, and its id there. */
export interface AppearanceKey {
	componentName: string
	/** The id after `<name>:`, or undefined for the component's own frame. */
	frameId: string | undefined
}

/**
 * Where the frame `frameName` keeps an appearance that is not saved: under the component it sits
 * inside when it is namespaced `<name>:<id>`, such as an obstacle's shape, and under its own name
 * otherwise. Unlike `appearanceTargetOf`, it needs no part component, so it covers every frame the
 * machine reports.
 */
export const appearanceKeyOf = (frameName: string): AppearanceKey => {
	const owner = ownerOfInternalFrame(frameName)
	return owner === undefined
		? { componentName: frameName, frameId: undefined }
		: { componentName: owner, frameId: frameName.slice(owner.length + 1) }
}
