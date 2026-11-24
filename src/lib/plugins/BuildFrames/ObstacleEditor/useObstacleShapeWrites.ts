import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
import { obstacleGeometriesOf, type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'
import { obstacleEditError } from '#lib/obstacleEditError.js'
import { complexObstacleVisualizer, type ShapeIndexMove } from '#lib/obstacleVisualizer.js'

/** One Complex obstacle's next geometries, and where each old shape's saved appearance goes. */
export interface ObstacleShapesEdit {
	component: PartComponent
	next: ObstacleGeometryConfig[]
	move: ShapeIndexMove
	/** Labels of shapes the edit duplicated, keyed to their sources', so each copy keeps its look. */
	copies?: ReadonlyMap<string, string>
}

interface ObstacleShapeWrites {
	/**
	 * Writes every edit in one config write when rdk would accept them all. Otherwise writes
	 * nothing.
	 *
	 * @returns Why rdk would reject the first edit it would, or undefined once written.
	 */
	write: (edits: readonly ObstacleShapesEdit[]) => string | undefined
}

/** Writes Complex obstacle edits that may span several obstacles. */
export const useObstacleShapeWrites = (): ObstacleShapeWrites => {
	const partConfig = usePartConfig()

	return {
		write: (edits) => {
			for (const { component, next } of edits) {
				const error = obstacleEditError(obstacleGeometriesOf(component), next, undefined, 'shape')
				if (error) return edits.length === 1 ? error.message : `${component.name}: ${error.message}`
			}

			partConfig.updateComponents(
				new Map(
					edits.map(({ component, next, move, copies }) => [
						component.name,
						{
							attributes: { ...component.attributes, geometries: next },
							visualizer: complexObstacleVisualizer(component, next, move, copies),
						},
					])
				)
			)
			return undefined
		},
	}
}
