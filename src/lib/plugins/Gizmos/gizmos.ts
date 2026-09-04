import type { ValueOf } from 'type-fest'

/**
 * The tool the user has armed. `Idle` means the plugin holds no tool, which is
 * distinct from the visualizer's `interactionMode` — the mode can be `'gizmo'`
 * for a frame after a tool exits before the plugin hands the pointer back.
 */
export const GizmoModes = {
	Idle: 'idle',
	CoordinateSystem: 'coordinate-system',
	ReferencePlane: 'reference-plane',
	ReferenceGeometry: 'reference-geometry',
	Polyline: 'polyline',
	Angle: 'angle',
	Arrow: 'arrow',
} as const

export type GizmoMode = ValueOf<typeof GizmoModes>

/** Which world plane a reference plane lies in, named for the axes it spans. */
export type PlaneAxis = 'yz' | 'xz' | 'xy'

/** `free` puts the plane at the clicked point; `offset` shifts it along its normal. */
export type PlanePlacement = 'free' | 'offset'

export type GeometryShape = 'box' | 'sphere' | 'capsule'

/** `at-origin` ignores the click point and places at the world origin. */
export type GeometryPlacement = 'at-origin' | 'free'

/** Every shape the reference-geometry tool can place, planes included. */
export type ReferenceShape = GeometryShape | 'plane'

/** `screen` keeps a polyline's width constant in pixels; `world` scales it with distance. */
export type LineSpace = 'world' | 'screen'

/** Which distances a polyline labels: nothing, each segment, or the running total. */
export type LineMeasure = 'none' | 'segment' | 'total'

/** `surface` orients an arrow along the clicked face's normal instead of a world axis. */
export type ArrowAxis = 'x' | 'y' | 'z' | 'surface'
