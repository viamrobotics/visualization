import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'
import type { ObstacleEditorHint } from '$lib/obstacleAttributes'

import {
	createBoundsObstacleComponent,
	createComplexObstacleComponent,
	createObstacleComponent,
} from '$lib/obstacle'

export type ObstacleType = ObstacleEditorHint['type']

export interface ObstacleTypeOption {
	type: ObstacleType
	label: string
	description: string
	/** What a new obstacle of this type is named before the user renames it: `<namePrefix>-N`. */
	namePrefix: string
	create: (name: string) => PartComponent
}

/** What each obstacle type is called, how it is described, and how it is created. */
export const OBSTACLE_TYPE_OPTIONS: Record<ObstacleType, ObstacleTypeOption> = {
	simple: {
		type: 'simple',
		namePrefix: 'obstacle',
		label: 'Simple',
		description: 'A single shape',
		create: createObstacleComponent,
	},
	complex: {
		type: 'complex',
		namePrefix: 'obstacle',
		label: 'Complex',
		description: 'A group of shapes',
		create: createComplexObstacleComponent,
	},
	bounds: {
		type: 'bounds',
		namePrefix: 'bounds',
		label: 'Bounds',
		description: 'Walls enclosing a box-shaped space',
		create: createBoundsObstacleComponent,
	},
}

/** The order the Add menu lists the types in. */
export const OBSTACLE_TYPE_ORDER: readonly ObstacleType[] = ['simple', 'bounds', 'complex']
