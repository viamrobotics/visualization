import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createFrame } from '$lib/frame'

/**
 * An obstacle is a component the machine never talks to. Its frame is the whole
 * point, since the geometry hanging off it is what the motion service plans
 * around. Viam's docs configure hardware-less components as a `fake` model.
 */
const OBSTACLE_API = 'rdk:component:generic'
const OBSTACLE_MODEL = 'rdk:builtin:fake'

/** Edge length of a new obstacle's box, in mm. Matches the custom geometry the `=` hotkey spawns. */
const OBSTACLE_EDGE_LENGTH = 100

/** A generic component at the world origin, carrying a box the user can then resize or reshape. */
export const createObstacleComponent = (name: string): PartComponent => ({
	name,
	api: OBSTACLE_API,
	model: OBSTACLE_MODEL,
	frame: {
		...createFrame(),
		geometry: {
			type: 'box',
			x: OBSTACLE_EDGE_LENGTH,
			y: OBSTACLE_EDGE_LENGTH,
			z: OBSTACLE_EDGE_LENGTH,
		},
	},
})

/** The first `obstacle-N` that `takenNames` leaves free. */
export const nextObstacleName = (takenNames: Iterable<string>): string => {
	const taken = new Set(takenNames)

	let index = 1
	while (taken.has(`obstacle-${index}`)) index += 1

	return `obstacle-${index}`
}
