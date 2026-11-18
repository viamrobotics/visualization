import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { createFrame } from '$lib/frame'
import {
	type BoundsHint,
	OBSTACLE_API,
	OBSTACLE_MODEL,
	type ObstacleAttributes,
} from '$lib/obstacleAttributes'

/** Edge length of a new obstacle's box, in mm. Matches the custom geometry the `=` hotkey spawns. */
const OBSTACLE_EDGE_LENGTH = 100

/** Label of the one shape a simple obstacle carries. */
export const SIMPLE_OBSTACLE_LABEL = 'shape'

/**
 * An `rdk:builtin:obstacle` component at the world origin. Its box is the single
 * `shape` entry in `attributes.geometries`, so the component's own frame carries no geometry.
 */
export const createObstacleComponent = (name: string): PartComponent => {
	const attributes: ObstacleAttributes = {
		geometries: [
			{
				label: SIMPLE_OBSTACLE_LABEL,
				type: 'box',
				x: OBSTACLE_EDGE_LENGTH,
				y: OBSTACLE_EDGE_LENGTH,
				z: OBSTACLE_EDGE_LENGTH,
			},
		],
	}

	return {
		name,
		api: OBSTACLE_API,
		model: OBSTACLE_MODEL,
		frame: createFrame(),
		attributes,
		visualizer: { type: 'simple' },
	}
}

/** What a new Bounds obstacle starts as: a 1000mm cube interior with 10mm walls on every face. */
export const DEFAULT_BOUNDS_HINT: BoundsHint = {
	type: 'bounds',
	x_mm: 1000,
	y_mm: 1000,
	z_mm: 1000,
	wall_thickness_mm: 10,
	exclude: [],
}

/**
 * An `rdk:builtin:obstacle` component whose geometries are the walls of the default Bounds hint.
 * It sits above the world origin by half its interior height, so the top of its floor lies on
 * the ground plane.
 */
export const createBoundsObstacleComponent = (name: string): PartComponent => {
	const hint: BoundsHint = { ...DEFAULT_BOUNDS_HINT, exclude: [...DEFAULT_BOUNDS_HINT.exclude] }
	const attributes: ObstacleAttributes = {
		geometries: generateBoundsGeometries(hint),
	}
	const frame = createFrame()
	frame.translation = { x: 0, y: 0, z: hint.z_mm / 2 }

	return {
		name,
		api: OBSTACLE_API,
		model: OBSTACLE_MODEL,
		frame,
		attributes,
		visualizer: { ...hint },
	}
}

/** Label of the one box a new Complex obstacle starts with. */
export const COMPLEX_OBSTACLE_FIRST_LABEL = 'shape-1'

/** An `rdk:builtin:obstacle` component at the world origin with one box, since rdk rejects an empty geometry list. */
export const createComplexObstacleComponent = (name: string): PartComponent => {
	const attributes: ObstacleAttributes = {
		geometries: [
			{
				label: COMPLEX_OBSTACLE_FIRST_LABEL,
				type: 'box',
				x: OBSTACLE_EDGE_LENGTH,
				y: OBSTACLE_EDGE_LENGTH,
				z: OBSTACLE_EDGE_LENGTH,
			},
		],
	}

	return {
		name,
		api: OBSTACLE_API,
		model: OBSTACLE_MODEL,
		frame: createFrame(),
		attributes,
		visualizer: { type: 'complex' },
	}
}

/** The first `<prefix>-N` that `takenNames` leaves free, e.g. `obstacle-1` or `bounds-2`. */
export const nextObstacleName = (takenNames: Iterable<string>, prefix: string): string => {
	const taken = new Set(takenNames)

	let index = 1
	while (taken.has(`${prefix}-${index}`)) index += 1

	return `${prefix}-${index}`
}
