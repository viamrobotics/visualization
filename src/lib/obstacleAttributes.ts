import type { Frame } from '$lib/frame'
import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

/**
 * rdk's obstacle model: a generic component whose `attributes.geometries` builds a
 * zero-DoF kinematic model, so one component can carry a compound obstacle. The
 * machine publishes it in the frame system as `<name>:<label>` links.
 */
export const OBSTACLE_API = 'rdk:component:generic'
export const OBSTACLE_MODEL = 'rdk:builtin:obstacle'

/** A geometry shape an obstacle editor can author: a frame geometry other than `none`. */
export type ObstacleShape = Exclude<Frame['geometry'], undefined | { type: 'none' }>

/**
 * One entry of `attributes.geometries`, the JSON shape of rdk's `spatialmath.GeometryConfig`.
 * Its offset positions it relative to the component's frame. rdk names an unlabeled entry by its
 * position, see {@link obstacleGeometryLabel}.
 */
export type ObstacleGeometryConfig = ObstacleShape & {
	label?: string
	translation?: Frame['translation']
	orientation?: Frame['orientation']
}

/**
 * Which editor wrote the geometries, so it can re-open them. It lives in the component's
 * `visualizer` config, which rdk does not read.
 */
export type ObstacleEditorHint = { type: 'simple' } | { type: 'complex' } | BoundsHint

/** The walls a Bounds obstacle can have. Each one's id doubles as its geometry label. */
export const BOUNDS_FACES = ['x_max', 'x_min', 'y_max', 'y_min', 'floor', 'ceiling'] as const

export type BoundsFace = (typeof BOUNDS_FACES)[number]

/** The Bounds form's values: an interior centered on the component frame, in mm, and the walls left out. */
export interface BoundsHint {
	type: 'bounds'
	x_mm: number
	y_mm: number
	z_mm: number
	wall_thickness_mm: number
	exclude: BoundsFace[]
}

// A type alias, not an interface: only an alias is assignable to `PartComponent['attributes']`'s index signature.
export type ObstacleAttributes = {
	geometries: ObstacleGeometryConfig[]
}

export const isObstacleComponent = (component: Pick<PartComponent, 'model'>): boolean =>
	component.model === OBSTACLE_MODEL

/** An obstacle component's geometries, or none when `attributes.geometries` is missing or not a list. */
export const obstacleGeometriesOf = (component: PartComponent): ObstacleGeometryConfig[] => {
	const geometries = component.attributes?.geometries
	return Array.isArray(geometries) ? (geometries as ObstacleGeometryConfig[]) : []
}

/**
 * The label the config sets on an entry, or `''` when it sets none. rdk's Go struct spells the
 * key `Label` and decodes case-insensitively, so both spellings count.
 */
export const explicitGeometryLabel = (geometry: ObstacleGeometryConfig): string => {
	const { label, Label: capitalizedLabel } = geometry as ObstacleGeometryConfig & { Label?: string }
	return label || capitalizedLabel || ''
}

/**
 * The name rdk gives the entry at `index` in the frame system, after `<component>:`. An
 * unlabeled entry is `geometry_<index>`.
 */
export const obstacleGeometryLabel = (geometry: ObstacleGeometryConfig, index: number): string =>
	explicitGeometryLabel(geometry) || `geometry_${index}`
