import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
import { obstacleGeometriesOf, type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'
import { obstacleEditError } from '#lib/obstacleEditError.js'
import { complexObstacleVisualizer, type ShapeIndexMove } from '#lib/obstacleVisualizer.js'

/** One Complex obstacle's next geometries, and where each old shape's saved appearance goes. */
export interface ObstacleShapesEdit {
	component: PartComponent
	next: ObstacleGeometryConfig[]
	move: ShapeIndexMove
}

/**
 * Writes Complex obstacle edits that may span several obstacles.
 *
 * @returns A function that writes every edit in one config write when rdk would accept them all,
 *   and otherwise writes nothing and returns why rdk would reject the first one it would.
 */
export const useObstacleShapeWrites = (): ((
	edits: readonly ObstacleShapesEdit[]
) => string | undefined) => {
	const partConfig = usePartConfig()

	return (edits) => {
		for (const { component, next } of edits) {
			const error = obstacleEditError(obstacleGeometriesOf(component), next, undefined, 'shape')
			if (error) return edits.length === 1 ? error.message : `${component.name}: ${error.message}`
		}

		partConfig.updateComponents(
			new Map(
				edits.map(({ component, next, move }) => [
					component.name,
					{
						attributes: { ...component.attributes, geometries: next },
						visualizer: complexObstacleVisualizer(component, next, move),
					},
				])
			)
		)
		return undefined
	}
}
