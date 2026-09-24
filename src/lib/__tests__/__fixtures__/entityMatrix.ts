import { Mesh, PointCloud } from '$lib/buf/common/v1/common_pb'
import { Arrows, Line, Nurbs, Points } from '$lib/buf/draw/v1/drawing_pb'

import type { EntityDraft, EntityKind } from './entityDrafts'

import { packFloats } from './entityDrafts'

/**
 * A shared behavior every applicable entity type is expected to honor
 * identically whether it arrives at spawn or through an update.
 */
export type SharedTrait =
	| 'pose'
	| 'rotation'
	| 'reparent'
	| 'center'
	| 'color-uniform'
	| 'colors-vertex'
	| 'color-swap'
	| 'opacity'
	| 'visibility'
	| 'visibility-unset'
	| 'axes-helper'
	| 'axes-helper-unset'

export interface TraitCase {
	name: string
	/** Applied to the reference spawn and to the candidate's initial spawn. */
	base?: (draft: EntityDraft) => void
	/** The change under test, applied to the reference spawn and the update. */
	apply: (draft: EntityDraft) => void
}

export interface EntityTypeDescriptor {
	name: string
	kind: EntityKind
	/**
	 * Instanced renderers write into shared GPU buffers and expose no
	 * per-entity `Object3D`, which decides the assertion backend downstream.
	 */
	renderer: 'instanced' | 'per-entity'
	/** Models cannot update in place; `updateModel` destroys and respawns. */
	updateVia?: 'model'
	traits: SharedTrait[]
	/** Cases that only exist for this type, e.g. line width. */
	extraCases?: TraitCase[]
	draft: (name: string) => EntityDraft
}

/** Exported because the e2e matrix asserts against the values these cases apply. */
export const PARENT_FRAME = 'matrix-parent'

export const UNIFORM_COLOR = new Uint8Array([255, 0, 0])
/** Three RGB triples, matching the three-vertex geometries below. */
export const VERTEX_COLORS = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
export const HALF_OPACITY = new Uint8Array([128])

/** Values the type-specific `extraCases` apply, asserted by the e2e matrix. */
export const POINT_SIZE = 20
export const LINE_WIDTH = 12
export const DOT_SIZE = 7
export const DOT_COLORS = new Uint8Array([1, 2, 3])

export const MOVED_POSE = { x: 100, y: 200, z: 300 }
export const ROTATED_POSE = { x: 0, y: 0, z: 0, oX: 0, oY: 1, oZ: 0, theta: 90 }
export const OFFSET_CENTER = { x: 10, y: 20, z: 30 }

const TRIANGLE = packFloats(0, 0, 0, 100, 0, 0, 100, 100, 0)
const ARROW_POSES = packFloats(0, 0, 0, 0, 0, 1, 100, 0, 0, 0, 0, 1)

// One [x, y, z, oX, oY, oZ, theta] row per control point. NURBSCurve requires
// knots.length === controlPoints.length + degree + 1, so four points pair with
// the eight-entry clamped knot vector below at the default degree of 3.
const NURBS_CONTROL_POINTS = packFloats(
	...[
		[0, 0, 0, 0, 0, 1, 0],
		[100, 0, 0, 0, 0, 1, 0],
		[100, 100, 0, 0, 0, 1, 0],
		[200, 100, 0, 0, 0, 1, 0],
	].flat()
)
const NURBS_KNOTS = packFloats(0, 0, 0, 0, 1, 1, 1, 1)

const baseDraft = (name: string, kind: EntityKind): EntityDraft => ({
	name,
	kind,
	uuid: 1,
	pose: { x: 0, y: 0, z: 0 },
	metadata: {},
})

/** Cases shared across every type that supports the behavior. */
export const SHARED_CASES: Record<SharedTrait, Omit<TraitCase, 'name'>> = {
	pose: {
		apply: (draft) => {
			draft.pose = { ...MOVED_POSE }
		},
	},
	rotation: {
		apply: (draft) => {
			draft.pose = { ...ROTATED_POSE }
		},
	},
	reparent: {
		apply: (draft) => {
			draft.parent = PARENT_FRAME
		},
	},
	center: {
		apply: (draft) => {
			draft.center = { ...OFFSET_CENTER }
		},
	},
	'color-uniform': {
		apply: (draft) => {
			draft.metadata.colors = UNIFORM_COLOR
		},
	},
	'colors-vertex': {
		apply: (draft) => {
			draft.metadata.colors = VERTEX_COLORS
		},
	},
	// Starts uniform so the update has a `Color` trait to retire: the two color
	// traits are mutually exclusive and `setColorTraits` must remove the loser.
	'color-swap': {
		base: (draft) => {
			draft.metadata.colors = UNIFORM_COLOR
		},
		apply: (draft) => {
			draft.metadata.colors = VERTEX_COLORS
		},
	},
	opacity: {
		apply: (draft) => {
			draft.metadata.opacities = HALF_OPACITY
		},
	},
	visibility: {
		apply: (draft) => {
			draft.metadata.invisible = true
		},
	},
	'visibility-unset': {
		base: (draft) => {
			draft.metadata.invisible = true
		},
		apply: (draft) => {
			draft.metadata.invisible = false
		},
	},
	'axes-helper': {
		apply: (draft) => {
			draft.metadata.showAxesHelper = true
		},
	},
	'axes-helper-unset': {
		base: (draft) => {
			draft.metadata.showAxesHelper = true
		},
		apply: (draft) => {
			draft.metadata.showAxesHelper = false
		},
	},
}

/** A geometry-carrying transform honors every shared case. */
const TRANSFORM_TRAITS = Object.keys(SHARED_CASES) as SharedTrait[]

/** A frame has no geometry, so it has no `center` to carry. */
const FRAME_TRAITS = TRANSFORM_TRAITS.filter((trait) => trait !== 'center')

/** `drawModel` reads only pose, parent, visibility, and the axes helper. */
const MODEL_TRAITS: SharedTrait[] = [
	'pose',
	'rotation',
	'reparent',
	'visibility',
	'visibility-unset',
	'axes-helper',
	'axes-helper-unset',
]

/**
 * The geometry-carrying transforms vary only by renderer and geometry oneof.
 * `geometry` is a factory so every draft gets its own proto to mutate.
 */
const transformType = (
	name: string,
	renderer: EntityTypeDescriptor['renderer'],
	geometry: () => EntityDraft['geometry']
): EntityTypeDescriptor => ({
	name,
	kind: 'transform',
	renderer,
	traits: TRANSFORM_TRAITS,
	draft: (draftName) => ({ ...baseDraft(draftName, 'transform'), geometry: geometry() }),
})

/** Every type-specific case swaps the whole shape oneof for a variant of itself. */
const shapeCase = (name: string, shape: () => EntityDraft['shape']): TraitCase => ({
	name,
	apply: (draft) => {
		draft.shape = shape()
	},
})

export const ENTITY_TYPES: EntityTypeDescriptor[] = [
	transformType('box', 'instanced', () => ({
		case: 'box',
		value: { dimsMm: { x: 10, y: 20, z: 30 } },
	})),
	transformType('sphere', 'instanced', () => ({ case: 'sphere', value: { radiusMm: 50 } })),
	transformType('capsule', 'instanced', () => ({
		case: 'capsule',
		value: { radiusMm: 25, lengthMm: 100 },
	})),
	transformType('mesh', 'per-entity', () => ({
		case: 'mesh',
		value: new Mesh({ contentType: 'ply', mesh: new Uint8Array(0) }),
	})),
	// The only type whose colours take a second path. `draw.ts` runs
	// `updatePointCloudColors` for it on top of `setColorTraits`, to write the
	// buffer without resetting a chunked cloud's draw range, and nothing else in
	// this table reaches that branch.
	transformType('pcd', 'per-entity', () => ({
		case: 'pointcloud',
		value: new PointCloud({ pointCloud: new Uint8Array(0) }),
	})),
	{
		name: 'frame',
		kind: 'transform',
		renderer: 'per-entity',
		traits: FRAME_TRAITS,
		draft: (name) => baseDraft(name, 'transform'),
	},
	{
		name: 'points',
		kind: 'drawing',
		renderer: 'per-entity',
		traits: TRANSFORM_TRAITS,
		extraCases: [
			shapeCase('point-size', () => ({
				case: 'points',
				value: new Points({ positions: TRIANGLE, pointSize: POINT_SIZE }),
			})),
		],
		draft: (name) => ({
			...baseDraft(name, 'drawing'),
			shape: { case: 'points', value: new Points({ positions: TRIANGLE }) },
		}),
	},
	{
		name: 'line',
		kind: 'drawing',
		renderer: 'per-entity',
		traits: TRANSFORM_TRAITS,
		extraCases: [
			shapeCase('line-width', () => ({
				case: 'line',
				value: new Line({ positions: TRIANGLE, lineWidth: LINE_WIDTH }),
			})),
			shapeCase('dot-size', () => ({
				case: 'line',
				value: new Line({ positions: TRIANGLE, dotSize: DOT_SIZE }),
			})),
			shapeCase('dot-colors', () => ({
				case: 'line',
				value: new Line({ positions: TRIANGLE, dotColors: DOT_COLORS }),
			})),
		],
		draft: (name) => ({
			...baseDraft(name, 'drawing'),
			shape: { case: 'line', value: new Line({ positions: TRIANGLE }) },
		}),
	},
	{
		name: 'nurbs',
		kind: 'drawing',
		renderer: 'per-entity',
		traits: TRANSFORM_TRAITS,
		extraCases: [
			shapeCase('line-width', () => ({
				case: 'nurbs',
				value: new Nurbs({
					controlPoints: NURBS_CONTROL_POINTS,
					knots: NURBS_KNOTS,
					lineWidth: LINE_WIDTH,
				}),
			})),
		],
		draft: (name) => ({
			...baseDraft(name, 'drawing'),
			shape: {
				case: 'nurbs',
				value: new Nurbs({ controlPoints: NURBS_CONTROL_POINTS, knots: NURBS_KNOTS }),
			},
		}),
	},
	{
		name: 'arrows',
		kind: 'drawing',
		renderer: 'per-entity',
		// `applyShape`'s arrows branch never reads `Shape.center`.
		traits: TRANSFORM_TRAITS.filter((trait) => trait !== 'center'),
		draft: (name) => ({
			...baseDraft(name, 'drawing'),
			shape: { case: 'arrows', value: new Arrows({ poses: ARROW_POSES }) },
		}),
	},
	{
		// A Drawing with no geometry oneof, which routes through the spawn and
		// update paths' `default` branches.
		name: 'bare-drawing',
		kind: 'drawing',
		renderer: 'per-entity',
		traits: TRANSFORM_TRAITS,
		draft: (name) => baseDraft(name, 'drawing'),
	},
	{
		name: 'model',
		kind: 'drawing',
		renderer: 'per-entity',
		updateVia: 'model',
		traits: MODEL_TRAITS,
		draft: (name) => ({
			...baseDraft(name, 'drawing'),
			shape: {
				case: 'model',
				value: {
					assets: [{ content: { case: 'url', value: 'https://example.com/model.glb' } }],
				},
			},
		}),
	},
]

/** Every case that applies to a type, shared cases first. */
export const casesFor = (type: EntityTypeDescriptor): TraitCase[] => [
	...type.traits.map((name) => ({ name, ...SHARED_CASES[name] })),
	...(type.extraCases ?? []),
]
