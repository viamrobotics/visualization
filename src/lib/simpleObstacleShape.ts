import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import {
	isObstacleComponent,
	obstacleGeometriesOf,
	type ObstacleShape,
} from '$lib/obstacleAttributes'
import { obstacleEditorType } from '$lib/obstacleEditorType'

/**
 * The part-owned Simple obstacle named `name`. Its one shape is what a scale gizmo resizes,
 * since the obstacle's own frame carries no geometry.
 */
export const simpleObstacleNamed = (
	components: PartComponent[] | undefined,
	name: string | undefined
): PartComponent | undefined => {
	const component = components?.find((candidate) => candidate.name === name)
	if (!component || !isObstacleComponent(component)) return undefined
	return obstacleEditorType(component) === 'simple' ? component : undefined
}

/** A Simple obstacle's one shape, without its label or offset. */
export const simpleObstacleShape = (component: PartComponent): ObstacleShape | undefined => {
	const [entry] = obstacleGeometriesOf(component)
	if (!entry) return undefined

	switch (entry.type) {
		case 'box': {
			return { type: 'box', x: entry.x, y: entry.y, z: entry.z }
		}
		case 'sphere': {
			return { type: 'sphere', r: entry.r }
		}
		case 'capsule': {
			return { type: 'capsule', r: entry.r, l: entry.l }
		}
		default: {
			return undefined
		}
	}
}

/** The obstacle's attributes with its one shape replaced by `shape`, keeping the label and offset. */
export const withSimpleObstacleShape = (
	component: PartComponent,
	shape: ObstacleShape
): Record<string, unknown> => {
	const [entry] = obstacleGeometriesOf(component)
	const { label, translation, orientation } = entry ?? {}

	return {
		...component.attributes,
		geometries: [
			{
				...shape,
				...(label === undefined ? {} : { label }),
				...(translation === undefined ? {} : { translation }),
				...(orientation === undefined ? {} : { orientation }),
			},
		],
	}
}
