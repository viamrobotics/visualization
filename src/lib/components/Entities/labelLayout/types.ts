/**
 * Shared types for the label layout engine.
 *
 * All spatial fields are in viewport pixels (one shared screen-space for every
 * label) except where noted. Slots store dot-relative offsets so a camera pan
 * never invalidates them.
 */

/** Axis-aligned rectangle as center + half-extents (viewport px). */
export interface Rect {
	cx: number
	cy: number
	hw: number
	hh: number
}

/** Line segment (viewport px). */
export interface Segment {
	x1: number
	y1: number
	x2: number
	y2: number
}

/** A candidate placement for a label box, expressed as the box-center offset from the dot. */
export interface Slot {
	/** Box-center offset from the dot, viewport px. */
	dx: number
	dy: number
	/** Direction of the slot from the dot, radians. */
	angle: number
	/** Distance from the dot to the box center, viewport px. */
	radius: number
	/** Ring index (0 = innermost). */
	ring: number
	/** Length-only cost (`W.len * radius`); slots are sorted ascending by this for early-out. */
	baseCost: number
}

export interface LabelNode {
	/** Stable per-element id, assigned once. */
	id: string
	/** FNV hash of `id`, used for deterministic tie-breaks and per-node slot phase. */
	idHash: number

	/** Anchor x, the projected dot center (viewport px), refreshed each solve. */
	ax: number
	/** Anchor y, the projected dot center (viewport px), refreshed each solve. */
	ay: number
	dotR: number

	/** Box full width (viewport px), refreshed each solve. */
	w: number
	/** Box full height (viewport px), refreshed each solve. */
	h: number

	/** Per-island CSS scale (screenPx / localPx). */
	scale: number
	/** Cached computed CSS width of the dot (local px); read once. */
	cssDotW: number
	/** Dot center relative to the island origin, island-local px. Fixed CSS offset, measured once (NaN until then). */
	dotLocalX: number
	dotLocalY: number

	slots: Slot[]
	/** Hash of the box/dot geometry; slots regenerate only when this or `crowded` changes. */
	geomKey: string
	crowded: boolean

	/** Committed slot (target). -1 before first placement. */
	slotIndex: number
	/** Slot committed by the previous solve, for stickiness. */
	prevSlotIndex: number

	/** Animated box center x. `writeBack` consumes it and the next solve seeds from it. */
	cx: number
	/** Animated box center y. `writeBack` consumes it and the next solve seeds from it. */
	cy: number
	/** Target box center x for the current solve. */
	tx: number
	/** Target box center y for the current solve. */
	ty: number
	settled: boolean

	/** Conflict cost of the current slot — the local-search loop key. */
	conflict: number
	/** Locked at a local optimum for the current solve. */
	locked: boolean

	/** Local cluster centroid (self + neighbors) for the outward-fan term. */
	centroidX: number
	centroidY: number

	/** Anchor at the previous solve, for teleport detection. NaN before first solve. */
	prevAx: number
	prevAy: number

	/** Pruned interaction set for the current solve (symmetric). */
	neighbors: LabelNode[]

	labelEl: HTMLElement
	textEl: HTMLElement
	dotEl: HTMLElement
	lineEl: SVGLineElement
}

export interface SolverConfig {
	/** Label-label clearance (viewport px). */
	labelPadding: number
	/** Dot clearance (viewport px). */
	dotPadding: number
	/** Candidate angles per ring (doubled for crowded nodes). */
	anglesPerRing: number
	/** Ring radius multipliers for sparse nodes. */
	ringRadii: number[]
	/** Ring radius multipliers for crowded nodes (more escape room). */
	ringRadiiCrowded: number[]
	/** Max accepted local-search moves per solve. */
	polishBudget: number
	/** Max neighbors considered per node (caps cost in dense clusters). */
	maxNeighbors: number
	/** Distance (viewport px) under which a box is considered arrived. */
	settleEps: number
	/** Neighbor count above which a node is "crowded". */
	crowdedThreshold: number
	/** Fraction of the viewport diagonal that counts as a camera teleport. */
	teleportFrac: number
}

export const defaultSolverConfig: SolverConfig = {
	labelPadding: 6,
	dotPadding: 6,
	anglesPerRing: 12,
	ringRadii: [1, 1.55, 2.2],
	ringRadiiCrowded: [1, 1.45, 1.95, 2.6],
	polishBudget: 240,
	maxNeighbors: 24,
	settleEps: 0.4,
	crowdedThreshold: 8,
	teleportFrac: 0.5,
}
