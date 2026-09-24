/**
 * Rebuilds the flattened frame system RDK's motion service would build, out of the per-part
 * `FrameSystemConfig` a robot hands a browser. Targets RDK v1.x; Go symbols are named rather than
 * cited by line.
 */

import type { Struct } from '@bufbuild/protobuf'
import type { commonApi, robotApi } from '@viamrobotics/sdk'

import { Geometry } from '$lib/buf/common/v1/common_pb'
import { Pose } from '$lib/math'

import type { DecodedFrame, FrameSystemJson, RawFrame } from './frameDescriptors'

import { DECODED_FRAME_TYPE } from './frameDescriptors'

/** RDK's `referenceframe.World`, the root every chain terminates at. */
const WORLD = 'world'

/** The suffix RDK gives a part's mount offset when it splits it off the part's own frame. */
const originName = (part: string): string => `${part}_origin`

/**
 * The fields of RDK's `ModelConfigJSON` this file reads. Everything else it carries — `name`,
 * `original_file`, `dhParams` — is either unused or unsupported by the descriptor builder.
 */
interface ModelConfig {
	links?: ModelNode[]
	joints?: Array<ModelNode & { type?: string }>
	kinematic_param_type?: string
}

interface ModelNode {
	id?: string
	parent?: string
}

/**
 * A node RDK would accept, resolved so the emit loops need no per-node guards. `config` is the node
 * verbatim, because `frameDescriptors` reads an axis and a mimic off it.
 */
interface DrawableNode {
	id: string
	parent?: string
	config: unknown
}

interface DrawableJoint extends DrawableNode {
	motion: 'rotational' | 'translational'
}

/** A model every one of whose nodes RDK would have accepted. */
interface DrawableModel {
	/** The raw config, carried on the `model` frame for `modelJointColumns` to read joint order from. */
	config: ModelConfig
	links: DrawableNode[]
	joints: DrawableJoint[]
}

/**
 * Only a missing or empty name means "unnamed". Explicit rather than a truth test: a `Struct` can
 * carry a numeric `0` id, which is falsy but names a frame.
 */
const nodeName = (value: string | undefined): string | undefined =>
	value === undefined || value === '' ? undefined : value

/**
 * A model with any node RDK would reject is rejected whole. Skipping the one node leaves its
 * children naming a frame nothing emits, so they draw at the scene origin rather than dropping.
 */
const drawableModelOf = (
	kinematics: Struct | undefined,
	partName: string
): DrawableModel | undefined => {
	if (!kinematics) return undefined

	const config = kinematics.toJson() as ModelConfig
	const skip = (reason: string): undefined => {
		console.warn(`[motion] "${partName}" ${reason} — its model is not drawn`)
		return undefined
	}

	// Before the links/joints test: a DH config carries `dhParams` and neither list, so a check
	// placed after it would discard the part as model-less and never warn.
	if (config.kinematic_param_type === 'DH') return skip('uses DH kinematics, which are unsupported')

	// `Array.isArray`, not a length test: these come off a `Struct` and can be any JSON shape, and
	// `{ length: 2 }` passes a length check then throws on iteration.
	const rawLinks = Array.isArray(config.links) ? config.links : []
	const rawJoints = Array.isArray(config.joints) ? config.joints : []
	if (rawLinks.length === 0 && rawJoints.length === 0) return undefined

	const links: DrawableNode[] = []
	for (const link of rawLinks) {
		const id = nodeName(link.id)
		if (id === undefined) return skip('has a link with no id')
		links.push({ id, parent: link.parent, config: link })
	}

	const joints: DrawableJoint[] = []
	for (const joint of rawJoints) {
		const id = nodeName(joint.id)
		if (id === undefined) return skip('has a joint with no id')
		const motion = jointFrameType(joint.type)
		if (!motion) return skip(`has joint "${id}" of unsupported type "${String(joint.type)}"`)
		joints.push({ id, parent: joint.parent, motion, config: joint })
	}

	return { config, links, joints }
}

/**
 * RDK registers `revolute`, `prismatic`, `continuous` and `fixed`; `JointConfig.ToFrame` builds a
 * frame for the first two and errors on the others. Mapping only those keeps the rest out.
 */
const jointFrameType = (type: string | undefined): 'rotational' | 'translational' | undefined => {
	if (type === 'revolute') return 'rotational'
	if (type === 'prismatic') return 'translational'
	return undefined
}

const decodedFrame = (pose: Pose, geometry: DecodedFrame['geometry']): RawFrame => ({
	frame_type: DECODED_FRAME_TYPE,
	frame: { pose, geometry } satisfies DecodedFrame,
})

/**
 * Not a cast: the SDK and this package generate `common.v1.Geometry` separately, and mesh bytes are
 * typed `ArrayBufferLike` on one side and `ArrayBuffer` on the other.
 */
const toLocalGeometry = (geometry: commonApi.Geometry | undefined): Geometry | null =>
	geometry ? Geometry.fromBinary(geometry.toBinary()) : null

/**
 * A model's own links and joints name their parents inside the model's namespace, and the root one
 * names `world` — meaning the model's own mount, not the scene root.
 */
const modelInternalParent = (part: string, parent: string | undefined): string => {
	const name = nodeName(parent)
	return name === undefined || name === WORLD ? originName(part) : `${part}:${name}`
}

export const frameSystemToPlanFrames = (parts: robotApi.FrameSystemConfig[]): FrameSystemJson => {
	const frames: Record<string, RawFrame> = {}
	const parents: Record<string, string> = {}

	for (const part of parts) {
		// One malformed part costs its own frames and no one else's. `Struct.toJson()` throws on a
		// non-finite number and on a `Value` with no kind set, and an uncaught throw loses the scene.
		try {
			addPart(part, frames, parents)
		} catch (error) {
			console.warn(
				`[motion] could not read the frame config for "${part.frame?.referenceFrame ?? 'an unnamed part'}" — not drawn`,
				error
			)
		}
	}

	return { frames, parents }
}

const addPart = (
	part: robotApi.FrameSystemConfig,
	frames: Record<string, RawFrame>,
	parents: Record<string, string>
): void => {
	const transform = part.frame
	const name = transform?.referenceFrame
	// The world root is not a part and has no offset of its own to place. `!transform` is redundant
	// with `!name` at runtime and load-bearing for the narrowing below.
	if (!transform || !name || name === WORLD) return

	const origin = originName(name)

	// A part `cam` and a part literally named `cam_origin` both want `frames['cam_origin']`, and
	// whichever lands second would silently overwrite the first. Both keys, to catch either order.
	if (frames[origin] !== undefined || frames[name] !== undefined) {
		console.warn(
			`[motion] "${name}" collides with a frame name another part already generated — not drawn`
		)
		return
	}

	// `||`, not `??`: the empty string is the case being defended against. RDK hard-errors with
	// `ErrEmptyStringFrameName`, so rooting at the world keeps the rest of the scene drawable.
	parents[origin] = transform.poseInObserverFrame?.referenceFrame || WORLD

	const model = drawableModelOf(part.kinematics, name)
	const geometry = toLocalGeometry(transform.physicalObject)

	// Unconditional: `createFramesFromPart` calls `ToStaticFrame(name + "_origin")`, which attaches
	// the configured geometry, before it has looked at the model at all. A modelled part has one too.
	frames[origin] = decodedFrame(new Pose().copy(transform.poseInObserverFrame?.pose), geometry)

	parents[name] = origin

	if (!model) {
		// Present but empty: descendants parent to the bare name, and `buildFrameContexts` needs
		// the entry to resolve their context.
		frames[name] = decodedFrame(new Pose(), null)
		return
	}

	// RDK publishes no model here: `createFramesFromPart` swaps in a bare static frame when
	// `len(DoF()) == 0` and the part configures a geometry. A static frame is not flattenable, so
	// no links follow.
	if (model.joints.length === 0 && geometry) {
		// Identity, where RDK uses the model's zero-input pose: matching it would mean a second
		// forward kinematics here. Anything parented to the bare part name is off by the rest extent.
		frames[name] = decodedFrame(new Pose(), null)
		return
	}

	// Draws nothing; it exists so `buildFrameContexts` can read the joint order off it and remap
	// anything parented to the bare part name onto the end effector.
	frames[name] = { frame_type: 'model', frame: { name, model: model.config } }

	// Links before joints, as RDK writes its own `transforms` map. Not cosmetic: the end-effector
	// fallback takes the first child of the last joint, indexed by iterating `parents`.
	for (const link of model.links) {
		const frameName = `${name}:${link.id}`
		frames[frameName] = {
			frame_type: 'named',
			frame: { name: frameName, inner_frame: { frame_type: 'static', frame: link.config } },
		}
		parents[frameName] = modelInternalParent(name, link.parent)
	}

	for (const joint of model.joints) {
		const frameName = `${name}:${joint.id}`
		frames[frameName] = {
			frame_type: 'named',
			frame: { name: frameName, inner_frame: { frame_type: joint.motion, frame: joint.config } },
		}
		parents[frameName] = modelInternalParent(name, joint.parent)
	}
}
