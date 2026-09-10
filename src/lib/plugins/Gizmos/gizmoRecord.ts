import type { PlaneAxis } from './gizmos'

/**
 * Bump when a change to `GizmoRecord` or `GizmoStore` would make an already-stored
 * payload decode wrongly. A payload at any other version is discarded on load
 * rather than migrated: gizmos are annotations a user can replace in seconds, so
 * the cost of losing them is far below the cost of maintaining migrations.
 */
export const GIZMO_STORE_VERSION = 2

/** Fields every placed gizmo carries, whatever its kind. */
interface GizmoRecordBase {
	name: string
	/**
	 * The entity's local `Matrix`, 16 elements in column-major order, in scene units
	 * (metres). Geometry dimensions elsewhere in this file are mm, matching the traits
	 * they come from. That split is confusing but it mirrors the ECS, and converting
	 * here would put the conversion in two places instead of one.
	 */
	matrix: number[]
	/**
	 * The parent frame's **name**, or absent for a world-parented gizmo. A name rather
	 * than an entity id because ids are not stable across a reload, and because
	 * `hierarchy.setParent` already takes a name and handles one that does not resolve.
	 */
	parent?: string
	/** RGB 0-255. Absent means the renderer's default. */
	color?: [r: number, g: number, b: number]
	opacity?: number
	showAxesHelper?: boolean
}

interface CoordinateSystemRecord extends GizmoRecordBase {
	kind: 'coordinate-system'
}

interface ReferenceGeometryRecord extends GizmoRecordBase {
	kind: 'reference-geometry'
	/** Dimensions in mm, as the geometry traits store them. */
	shape:
		| { type: 'box'; x: number; y: number; z: number }
		| { type: 'sphere'; r: number }
		| { type: 'capsule'; l: number; r: number }
	wireframe?: boolean
}

interface ReferencePlaneRecord extends GizmoRecordBase {
	kind: 'reference-plane'
	/** Dimensions in mm. */
	width: number
	height: number
	axis: PlaneAxis
}

interface ArrowRecord extends GizmoRecordBase {
	kind: 'arrow'
}

/** Shared by the two line-backed gizmos, which differ only in what labels them. */
interface LineRecordBase extends GizmoRecordBase {
	/** Flat xyz triples in scene units (metres), as `LinePositions` stores them. */
	positions: number[]
	lineWidth: number
}

interface PolylineRecord extends LineRecordBase {
	kind: 'polyline'
	dotSize: number
	dotColors?: number[]
	screenSpace?: boolean
	lineMeasure?: 'segment' | 'total'
}

interface AngleRecord extends LineRecordBase {
	kind: 'angle'
}

/**
 * One placed gizmo. Discriminated on `kind` so a reader can switch exhaustively and
 * a new kind fails the typecheck at every site that has to handle it.
 */
export type GizmoRecord =
	| CoordinateSystemRecord
	| ReferenceGeometryRecord
	| ReferencePlaneRecord
	| ArrowRecord
	| PolylineRecord
	| AngleRecord

export type GizmoKind = GizmoRecord['kind']

/** What a single machine part's store holds. */
export interface GizmoStore {
	version: number
	gizmos: GizmoRecord[]
}

/**
 * Storage key for one machine part. Scoped per part so gizmos placed against one
 * machine never surface on another, which also means a parent frame missing on load
 * signals a real config change rather than a different robot.
 *
 * Matches the part-scoped key idiom in `ControlWidgets/ResourceWidgetRow.svelte`.
 */
export const gizmoStoreKey = (partID: string) => `${partID}:gizmos`
