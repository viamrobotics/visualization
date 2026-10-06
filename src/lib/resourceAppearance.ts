import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

/**
 * How a resource is drawn, saved in its `visualizer` config so a workcell keeps its look. The
 * keys mirror the draw API's `Metadata`. Each one is optional, and a missing one leaves the
 * visualizer's default.
 */
export interface ResourceAppearance {
	/** `#rrggbb`, in sRGB. */
	color?: string
	/** From 0, invisible, to 1, opaque. */
	opacity?: number
	/** Hidden until shown from the world tree. */
	invisible?: boolean
	show_axes_helper?: boolean
}

/** An edit to a resource's appearance. A key set to `undefined` goes back to the default. */
export type ResourceAppearancePatch = Partial<ResourceAppearance>

/**
 * Where a frame inside a component, such as an obstacle's shape or an arm's link, saves what it
 * changes from the component's appearance. Keyed by the frame's id after `<name>:`.
 */
const FRAMES_KEY = 'frames'

const APPEARANCE_KEYS = ['color', 'opacity', 'invisible', 'show_axes_helper'] as const

const HEX_COLOR = /^#[\da-f]{6}$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const isOpacity = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

const parseAppearance = (value: unknown): ResourceAppearance => {
	if (!isRecord(value)) return {}
	const { color, opacity, invisible, show_axes_helper } = value

	return {
		...(typeof color === 'string' && HEX_COLOR.test(color) && { color: color.toLowerCase() }),
		...(isOpacity(opacity) && { opacity }),
		...(typeof invisible === 'boolean' && { invisible }),
		...(typeof show_axes_helper === 'boolean' && { show_axes_helper }),
	}
}

const patchAppearance = (
	record: Record<string, unknown>,
	patch: ResourceAppearancePatch
): Record<string, unknown> => {
	const next = { ...record }
	for (const key of APPEARANCE_KEYS) {
		if (!(key in patch)) continue
		const value = patch[key]
		if (value === undefined) delete next[key]
		else next[key] = value
	}
	return next
}

const CLEARED: ResourceAppearancePatch = Object.fromEntries(
	APPEARANCE_KEYS.map((key) => [key, undefined])
)

const savedFramesOf = (component: PartComponent): Record<string, unknown> => {
	const frames = component.visualizer?.[FRAMES_KEY]
	return isRecord(frames) ? frames : {}
}

/** The component's `visualizer` config with its frame entries replaced, dropping any left empty. */
const withSavedFrames = (
	component: PartComponent,
	frames: Record<string, unknown>
): Record<string, unknown> => {
	const kept = Object.fromEntries(
		Object.entries(frames).filter(([, entry]) => isRecord(entry) && Object.keys(entry).length > 0)
	)
	const next: Record<string, unknown> = { ...component.visualizer }
	delete next[FRAMES_KEY]
	return Object.keys(kept).length > 0 ? { ...next, [FRAMES_KEY]: kept } : next
}

/** The appearance a component saves for its own frame. A malformed value is left out. */
export const resourceAppearanceOf = (component: PartComponent): ResourceAppearance =>
	parseAppearance(component.visualizer)

/** What the frame `frameId` inside a component saves in place of the component's appearance. */
export const frameAppearanceOf = (component: PartComponent, frameId: string): ResourceAppearance =>
	parseAppearance(savedFramesOf(component)[frameId])

/** The appearance a component saves for itself, and for each frame inside it that changes it. */
export interface SavedAppearance {
	own: ResourceAppearance
	frames: ReadonlyMap<string, ResourceAppearance>
}

export const savedAppearanceOf = (component: PartComponent): SavedAppearance => ({
	own: resourceAppearanceOf(component),
	frames: new Map(
		Object.keys(savedFramesOf(component)).map((frameId) => [
			frameId,
			frameAppearanceOf(component, frameId),
		])
	),
})

/** Whether any appearance key is saved for the component's own frame. */
export const hasResourceAppearance = (component: PartComponent): boolean =>
	Object.keys(resourceAppearanceOf(component)).length > 0

/** Whether any frame inside the component saves its own appearance. */
export const hasFrameAppearances = (component: PartComponent): boolean =>
	[...savedAppearanceOf(component).frames.values()].some(
		(appearance) => Object.keys(appearance).length > 0
	)

/**
 * The component's `visualizer` config with `patch` applied to its own appearance. Keys the patch
 * sets to `undefined` are removed. Everything else, such as an obstacle's editor hint, is kept.
 */
export const withResourceAppearance = (
	component: PartComponent,
	patch: ResourceAppearancePatch
): Record<string, unknown> => patchAppearance({ ...component.visualizer }, patch)

/** The component's `visualizer` config with its own appearance keys removed. */
export const withoutResourceAppearance = (component: PartComponent): Record<string, unknown> =>
	withResourceAppearance(component, CLEARED)

/** The component's `visualizer` config with `patch` applied to what the frame `frameId` changes. */
export const withFrameAppearance = (
	component: PartComponent,
	frameId: string,
	patch: ResourceAppearancePatch
): Record<string, unknown> => {
	const frames = savedFramesOf(component)
	const entry = frames[frameId]
	return withSavedFrames(component, {
		...frames,
		[frameId]: patchAppearance(isRecord(entry) ? entry : {}, patch),
	})
}

/** The component's `visualizer` config with the frame `frameId` back to the component's appearance. */
export const withoutFrameAppearance = (
	component: PartComponent,
	frameId: string
): Record<string, unknown> => withFrameAppearance(component, frameId, CLEARED)

/** The component's `visualizer` config with every frame inside it back to the component's appearance. */
export const withoutFrameAppearances = (component: PartComponent): Record<string, unknown> =>
	withSavedFrames(component, {})

/**
 * The component's `visualizer` config with each frame's saved appearance moved to the frame's
 * new id, after a rename or a removal renumbered them. A frame moved to `undefined` was removed,
 * and its entry goes with it.
 */
export const withFrameAppearancesMoved = (
	component: PartComponent,
	moves: ReadonlyMap<string, string | undefined>
): Record<string, unknown> => {
	const frames = savedFramesOf(component)
	const next = Object.fromEntries(Object.entries(frames).filter(([frameId]) => !moves.has(frameId)))
	for (const [from, to] of moves) {
		if (to !== undefined && from in frames) next[to] = frames[from]
	}
	return withSavedFrames(component, next)
}
