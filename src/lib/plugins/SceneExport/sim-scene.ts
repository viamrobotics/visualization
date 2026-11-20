import type { BufferGeometry, Matrix4, Vector3 } from 'three'

/**
 * A sim-neutral snapshot of the scene, in metres and radians. The URDF and MJCF writers each read
 * this and nothing else, so both formats describe the same bodies, joints, and shapes.
 */
export interface SimScene {
	/** Every parent comes before its children. */
	bodies: SimBody[]
	notes: SimExportNote[]
}

/**
 * One rigid body. Its frame is the frame of the scene entity it came from, except for a joint
 * body, whose frame is the joint's: at the parent's origin when the joint value is zero.
 */
export interface SimBody {
	name: string
	/** `undefined` hangs the body off the world. */
	parent: string | undefined
	/** Pose relative to the parent body, or to the world. Rotation and translation only. */
	origin: Matrix4
	/** Moves the body about or along an axis through its own origin. A body without one is welded. */
	joint: SimJoint | undefined
	geoms: SimGeom[]
}

export interface SimJoint {
	type: 'revolute' | 'prismatic'
	/** Unit length, in the body's frame. */
	axis: Vector3
	/**
	 * Radians for revolute, metres for prismatic. `undefined` when the model sets no finite limits,
	 * as rdk does for a URDF `continuous` joint by giving a revolute joint infinite ones.
	 */
	limits: { lower: number; upper: number } | undefined
	/** The joint's position in the snapshot, in the same units as the limits. */
	value: number
	/** Per second, in the same units as the limits. `undefined` when the model sets none. */
	maxVelocity: number | undefined
}

export interface SimGeom {
	shape: SimShape
	/** Pose relative to the body. Rotation and translation only. Identity for a mesh. */
	origin: Matrix4
	/** sRGB, 0 to 1, alpha last. */
	rgba: [number, number, number, number]
	/** Viam geometries collide. A visual model drawn in place of one does not. */
	role: 'visual' | 'collision' | 'visual-and-collision'
}

/**
 * Primitive sizes are full extents in metres. A capsule's `length` includes both caps, as Viam
 * measures it, and it and the cylinder lie along Z.
 */
export type SimShape =
	| { kind: 'box'; size: Vector3 }
	| { kind: 'sphere'; radius: number }
	| { kind: 'cylinder'; radius: number; length: number }
	| { kind: 'capsule'; radius: number; length: number }
	/** Vertices already in the body's frame, so the geom origin is identity. */
	| { kind: 'mesh'; geometry: BufferGeometry }

/** One format's rendering of a `SimScene`: the document, the meshes it references, and its caveats. */
export interface SimDocument {
	document: string
	/** Keyed by the path the document references, relative to the document. */
	meshes: Map<string, BufferGeometry>
	/** Other text files that go beside the document, keyed by path relative to it. */
	sidecars: Map<string, string>
	notes: SimExportNote[]
}

/**
 * Something the export left out or approximated, named so the user can tell the sim scene apart
 * from the visualizer's.
 */
export interface SimExportNote {
	reason: SimExportNoteReason
	/** The entity, body, or joint the note is about. */
	subject: string
}

export type SimExportNoteReason =
	| 'point-cloud-skipped'
	| 'drawing-skipped'
	| 'hidden-skipped'
	| 'ghost-skipped'
	| 'model-visual-only'
	| 'model-load-failed'
	| 'dh-model-not-articulated'
	| 'joint-value-unknown'
	| 'link-not-articulated'
	| 'mesh-empty-skipped'
	| 'end-effector-unknown'
	| 'end-effector-offset-unknown'
	| 'collision-mesh-hulled'
	| 'mujoco-hulls-collision-mesh'
	| 'mujoco-flat-mesh-visual-only'
	| 'mujoco-mesh-too-few-vertices'
	| 'inertia-estimated'
	| 'joint-limits-placeholder'
