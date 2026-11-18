import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import {
	type ObstacleEditorHint,
	obstacleGeometriesOf,
	type ObstacleGeometryConfig,
	obstacleGeometryLabel,
} from '$lib/obstacleAttributes'
import { withFrameAppearancesMoved } from '$lib/resourceAppearance'

/** Every key an obstacle editor hint can set, so a new hint replaces all of the old one. */
const OBSTACLE_HINT_KEYS: ReadonlySet<string> = new Set([
	'type',
	'x_mm',
	'y_mm',
	'z_mm',
	'wall_thickness_mm',
	'exclude',
])

/**
 * The component's `visualizer` config with its obstacle editor hint replaced by `hint`. Keys the
 * hint does not own, such as appearance, are kept.
 */
export const withObstacleHint = (
	component: PartComponent,
	hint: ObstacleEditorHint
): Record<string, unknown> => ({
	...Object.fromEntries(
		Object.entries(component.visualizer ?? {}).filter(([key]) => !OBSTACLE_HINT_KEYS.has(key))
	),
	...hint,
})

/** Where the shape at `oldIndex` went after an edit, or undefined when the edit removed it. */
export type ShapeIndexMove = (oldIndex: number) => number | undefined

/** Every shape stays where it was, as after an add, a relabel or a shape change. */
export const SHAPES_IN_PLACE: ShapeIndexMove = (oldIndex) => oldIndex

/** The shape at `removedIndex` is gone, and the ones after it move up one. */
export const afterRemovingShape =
	(removedIndex: number): ShapeIndexMove =>
	(oldIndex) => {
		if (oldIndex === removedIndex) return undefined
		return oldIndex < removedIndex ? oldIndex : oldIndex - 1
	}

/**
 * The visualizer config a Complex obstacle edit writes: the Complex hint, with each shape's saved
 * appearance following the shape to its new frame id. A relabel renames the id, and a removal
 * renumbers the unlabeled shapes after it.
 */
export const complexObstacleVisualizer = (
	component: PartComponent,
	next: ObstacleGeometryConfig[],
	move: ShapeIndexMove
): Record<string, unknown> => {
	const moves = new Map<string, string | undefined>()
	for (const [oldIndex, geometry] of obstacleGeometriesOf(component).entries()) {
		const from = obstacleGeometryLabel(geometry, oldIndex)
		const newIndex = move(oldIndex)
		const moved = newIndex === undefined ? undefined : next[newIndex]
		const to = moved && newIndex !== undefined ? obstacleGeometryLabel(moved, newIndex) : undefined
		if (from !== to) moves.set(from, to)
	}

	return withObstacleHint(
		{ ...component, visualizer: withFrameAppearancesMoved(component, moves) },
		{ type: 'complex' }
	)
}
