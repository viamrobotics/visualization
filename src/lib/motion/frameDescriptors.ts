/**
 * A TypeScript reconstruction of how RDK resolves a flattened frame system into a drawable chain.
 * Each switch mirrors `register.go` and can fall behind. Spatialmath decoding lives in
 * `$lib/math/spatialJson`.
 */

import { protoBase64 } from '@bufbuild/protobuf'
import { Quaternion } from 'three'
import { UuidTool } from 'uuid-tool'

import {
	Capsule,
	Geometry,
	Mesh,
	RectangularPrism,
	Sphere,
	Vector3 as ViamVector3,
} from '$lib/buf/common/v1/common_pb'
import { Pose } from '$lib/math'
import {
	type FramePoseJson,
	geometryCenterInFrame,
	poseFromJson,
	quatFromJson,
	type RawOrientation,
	type Vec3Json,
} from '$lib/math/spatialJson'
import { meshContentType } from '$lib/mesh'

import type { ModelJson } from './jointColumns'

import { modelJointColumns, nodeName } from './jointColumns'

/** One entry of a flattened frame system: `frame_type` names the encoding, `frame` carries it. */
export interface RawFrame {
	frame_type: string
	frame: unknown
}

/**
 * Not an RDK frame type. `frameSystemToPlanFrames` carries a part's pose and geometry already
 * decoded: encoding them as a `static` frame would round-trip `Geometry` through a lossy
 * `GeometryConfig`.
 */
export const DECODED_FRAME_TYPE = 'decoded'

export interface DecodedFrame {
	pose: Pose
	geometry: Geometry | null
}

/**
 * The subset of RDK's `FrameSystem.MarshalJSON()` this file reads. `frames` is flat — a frame's
 * entry never names its parent, which is why `parents` is a separate index.
 */
export interface FrameSystemJson {
	frames: Record<string, RawFrame>
	parents: Record<string, string>
}

/**
 * Split from joints because a trajectory step only carries joint angles: every other frame's
 * pose is fixed for the whole plan and can be built once. On the reference dual-arm rig that
 * is 67 of 79 frames.
 */
export interface StaticFrameDescriptor {
	kind: 'static'
	name: string
	parent: string
	localPose: Pose
	geometry: Geometry | null
	uuid: Uint8Array<ArrayBuffer>
}

/**
 * A step addresses joints positionally (`left-arm: [0.1, -0.3, …]`), so `componentName` +
 * `jointIndex` are what turn a step into this frame's value.
 *
 * `motion` rather than a third `kind`: the addressing fields are shared, only the conversion differs.
 */
export interface JointFrameDescriptor {
	kind: 'joint'
	motion: 'rotational' | 'translational'
	name: string
	parent: string
	axis: { X: number; Y: number; Z: number }
	componentName: string
	jointIndex: number
	/**
	 * Present iff this joint mimics another: it has no column of its own, so `jointIndex` addresses
	 * its source's and the value to use is `multiplier * step[jointIndex] + offset`.
	 */
	mimic?: { multiplier: number; offset: number }
	uuid: Uint8Array<ArrayBuffer>
}

export type FrameDescriptor = StaticFrameDescriptor | JointFrameDescriptor

const tmpQ = new Quaternion()

/**
 * RDK's `ParseConfig` infers an empty `type` from whichever dimensions are set: box, then capsule,
 * then sphere. The predicates below are that chain, in that order.
 */
const inferGeometryType = (g: Record<string, unknown>): string => {
	const declared = (g.type ?? '') as string
	if (declared !== '') return declared

	const x = (g.x as number) ?? 0
	const y = (g.y as number) ?? 0
	const z = (g.z as number) ?? 0
	if (Math.hypot(x, y, z) > 0) return 'box'

	// `l` before `r`: a capsule sets both. `r` checks `> 0`, not `!== 0`, so a negative radius falls
	// through to `''` rather than building a sphere.
	if (((g.l as number) ?? 0) !== 0) return 'capsule'
	if (((g.r as number) ?? 0) > 0) return 'sphere'

	// A mesh sets none of x/y/z/l/r, so it is invisible to the chain above; without this it reads
	// as "no geometry" and drops silently instead of reaching the mesh branch's named warnings.
	if (g.mesh_data !== undefined || g.mesh_content_type !== undefined) return 'mesh'

	return ''
}

/** Why a `mesh_data` field could not be turned into bytes, so the warning can say which. */
type MeshDataProblem = 'absent' | 'unreadable' | 'empty'

/**
 * `mesh_data` is base64 from a plan dump and a number array from `frameSystemConfig`, decided by the
 * route rather than by the data. Both shapes are read here.
 */
const meshBytes = (raw: unknown): Uint8Array<ArrayBuffer> | MeshDataProblem => {
	if (raw === undefined || raw === null || raw === '') return 'absent'

	let bytes: Uint8Array<ArrayBuffer>

	if (Array.isArray(raw)) {
		// Rejected whole, not filtered: dropping an element shifts every byte after it, and a
		// byte-shifted mesh yields an empty geometry with no error rather than a decode failure.
		const clean = raw.every(
			(v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 256
		)
		if (!clean) return 'unreadable'
		bytes = Uint8Array.from(raw as number[])
	} else if (typeof raw === 'string') {
		try {
			// `from` narrows protoBase64's Uint8Array<ArrayBufferLike>, which the field rejects. `dec`
			// throws a bare Error, which `loadPlan` would otherwise report as an unparseable plan.
			bytes = Uint8Array.from(protoBase64.dec(raw))
		} catch {
			return 'unreadable'
		}
	} else {
		return 'unreadable'
	}

	// Both shapes: `[]` and `Uint8Array(0)` are truthy, and `dec` returns zero bytes without throwing
	// for padding- or whitespace-only strings.
	return bytes.length > 0 ? bytes : 'empty'
}

/**
 * Pass `framePose` for arm links, whose center is in parent coordinates (see
 * `geometryCenterInFrame`); omit it for obstacles, whose center is already local. The JSON
 * looks identical either way — only the frame's kind says which convention applies.
 *
 * Decodes Go `GeometryConfig` marshal (`frame_system` and `obstacles_in_world_frame`), not
 * proto-JSON `world_state` geometries.
 */
export const parseGeometry = (
	geom: unknown,
	frameName: string,
	framePose?: FramePoseJson
): Geometry | null => {
	// Naming the frame is the difference between a warning you can act on and one you can't:
	// a capture has dozens of geometries and they all skip through this one line.
	const skip = (reason: string): null => {
		console.warn(`[motion] skipping geometry on "${frameName}": ${reason}`)
		return null
	}

	if (!geom || typeof geom !== 'object') return null
	const g = geom as Record<string, unknown>
	const type = inferGeometryType(g)

	// An empty type means "no geometry": Go marshals the zero value rather than omitting it, and
	// inference returns the same when nothing was set. An unrecognized type warns below instead.
	if (type === '') return null

	const trans = g.translation as Vec3Json | undefined
	const orient = g.orientation as RawOrientation | undefined
	const center = framePose
		? geometryCenterInFrame(trans, orient, framePose)
		: (() => {
				const local = new Pose(trans?.X ?? 0, trans?.Y ?? 0, trans?.Z ?? 0)
				if (quatFromJson(orient, tmpQ)) local.setFromQuaternion(tmpQ)
				return local
			})()

	// Capitalized because RDK leaves the field untagged and Go marshals its exported name — as
	// with X/Y/Z and W. There is no lowercase spelling to fall back to.
	const label = (g.Label ?? '') as string

	switch (type) {
		case 'sphere': {
			return new Geometry({
				center,
				geometryType: { case: 'sphere', value: new Sphere({ radiusMm: (g.r as number) ?? 0 }) },
				label,
			})
		}

		case 'capsule': {
			return new Geometry({
				center,
				geometryType: {
					case: 'capsule',
					value: new Capsule({ radiusMm: (g.r as number) ?? 0, lengthMm: (g.l as number) ?? 0 }),
				},
				label,
			})
		}

		case 'box': {
			return new Geometry({
				center,
				geometryType: {
					case: 'box',
					value: new RectangularPrism({
						dimsMm: new ViamVector3({
							x: (g.x as number) ?? 0,
							y: (g.y as number) ?? 0,
							z: (g.z as number) ?? 0,
						}),
					}),
				},
				label,
			})
		}

		// Bytes pass through unscaled: PLY and STL vertices are already meters, and only the
		// center pose is millimeters.
		case 'mesh': {
			const declared = g.mesh_content_type as string | undefined

			// The renderer falls back to PLY for a label it cannot read; a plan is parsed once, so name the skip
			// here rather than draw nothing later.
			const contentType = meshContentType(declared)
			if (!contentType) return skip(`unsupported mesh content type "${declared ?? ''}"`)

			const mesh = meshBytes(g.mesh_data)
			if (mesh === 'absent') return skip('mesh geometry carries no mesh_data')
			if (mesh === 'empty') return skip('mesh geometry carries empty mesh_data')
			if (mesh === 'unreadable') return skip('mesh geometry carries undecodable mesh_data')

			return new Geometry({
				center,
				geometryType: { case: 'mesh', value: new Mesh({ contentType, mesh }) },
				label,
			})
		}

		// Skip rather than substitute: a stand-in shape would lie about where the collision
		// volume is, and one unrenderable shape shouldn't cost the whole trajectory.
		default: {
			return skip(`unsupported geometry type "${type}"`)
		}
	}
}

type Frames = FrameSystemJson['frames']

const modelOf = (entry: Frames[string]): ModelJson | undefined =>
	(entry.frame as Record<string, unknown>).model as ModelJson | undefined

/**
 * The model's one childless frame, over links and joints. Undefined when there is more than one,
 * which RDK also refuses, and for a DH model, whose topology lives in `dhParams` not either list.
 */
const soleLeafOf = (model: ModelJson | undefined): string | undefined => {
	const links = model?.links
	const joints = model?.joints
	// `Array.isArray`, not `??`: a malformed capture can declare these as `{}`, and spreading a
	// non-iterable throws, taking the whole plan render down.
	const nodes = [...(Array.isArray(links) ? links : []), ...(Array.isArray(joints) ? joints : [])]

	// `nodeName` here too: an id of `''`, which Go marshals rather than omits, would otherwise read
	// as an unclaimed leaf of its own and turn a real sole leaf into "more than one".
	const claimed = new Set(nodes.flatMap((node) => nodeName(node.parent) ?? []))
	const leaves = nodes.flatMap((node) => {
		const id = nodeName(node.id)
		return id !== undefined && !claimed.has(id) ? id : []
	})

	return leaves.length === 1 ? leaves[0] : undefined
}

/**
 * Which frame a model hands its children to: the envelope's `primary_output_frame`, then the
 * config's `output_frames[0]`, then the sole leaf.
 */
const modelOutputFrame = (
	entry: Frames[string],
	model: ModelJson | undefined
): string | undefined => {
	const declared = (entry.frame as Record<string, unknown>).primary_output_frame
	if (typeof declared === 'string' && declared !== '') return declared

	// `Array.isArray` first: indexing a bare string would yield its first character, which the
	// `typeof` guard below would then happily accept.
	const frames = model?.output_frames
	const configured = Array.isArray(frames) ? (frames[0] as unknown) : undefined
	if (typeof configured === 'string' && configured !== '') return configured

	return soleLeafOf(model)
}

const newUuid = (): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(UuidTool.toBytes(crypto.randomUUID()))

/**
 * The two facts a frame's own entry cannot supply.
 *
 * `frames` is flat: a joint frame knows it rotates about an axis, but not which arm owns it,
 * and a frame may be parented to a *model* frame (e.g. camera parented to left-arm), which never becomes an entity. Both
 * answers need the model declarations, so they are resolved once here and read back per frame.
 */
interface FrameContext {
	/** Parent with model frames already resolved away — safe to use as a descriptor's parent. */
	parent: string
	/** Present iff a model claims this frame as a joint. Absent means no trajectory column. */
	joint?: Pick<JointFrameDescriptor, 'componentName' | 'jointIndex' | 'mimic'>
}

const buildFrameContexts = (frameSystem: FrameSystemJson): Map<string, FrameContext> => {
	const { frames, parents } = frameSystem

	// Inverted `parents`. Its only question is "what hangs off the last joint?", asked below when
	// a model declares no end-effector — hence local, not a field on the frames it describes.
	const childMap = new Map<string, string[]>()
	for (const [child, parent] of Object.entries(parents)) {
		const siblings = childMap.get(parent)
		if (siblings) siblings.push(child)
		else childMap.set(parent, [child])
	}

	const jointOwners = new Map<string, FrameContext['joint']>()
	const modelTerminals = new Map<string, string>()

	for (const [modelName, entry] of Object.entries(frames)) {
		if (entry.frame_type !== 'model') continue
		const model = modelOf(entry)

		// Which slot of a trajectory step drives which frame. Keyed by frame name because that is how
		// the frame asks — the join between the two is the `${model}:${id}` convention, nothing else.
		const { order, columns } = modelJointColumns(model, modelName)
		for (const [jointId, column] of columns) {
			jointOwners.set(`${modelName}:${jointId}`, {
				componentName: modelName,
				jointIndex: column.index,
				mimic: column.mimic,
			})
		}

		// Truthy rather than `!== undefined`: all three branches filter an empty id, so this never sees `''`.
		const endEffectorId = modelOutputFrame(entry, model)
		if (endEffectorId) {
			modelTerminals.set(modelName, `${modelName}:${endEffectorId}`)
			continue
		}

		// Walk order, not declaration order: they disagree unless the joints are declared down their
		// own chain. Only reached by a model with no output frame and no single leaf, which RDK
		// will not marshal.
		const lastJointId = order.at(-1)
		if (!lastJointId) continue
		const terminal = childMap.get(`${modelName}:${lastJointId}`)?.[0]
		if (terminal) modelTerminals.set(modelName, terminal)
	}

	const contexts = new Map<string, FrameContext>()
	for (const frameName of Object.keys(frames)) {
		const rawParent = parents[frameName] ?? 'world'
		contexts.set(frameName, {
			parent: modelTerminals.get(rawParent) ?? rawParent,
			joint: jointOwners.get(frameName),
		})
	}

	return contexts
}

/**
 * `referenceframe/register.go` registers more frame types than the switches cover. An unhandled one
 * produces no descriptor: its frame is absent from the scene, and anything parented to it unresolved.
 */
const warnUnhandledFrame = (frameName: string, frameType: unknown): void => {
	console.warn(
		`[motion] unhandled frame type "${String(frameType)}" on "${frameName}" — frame not drawn`
	)
}

/**
 * A straight map over `frames` — every cross-frame question was already answered by
 * {@link buildFrameContexts}, so each entry is built from itself plus its context.
 */
const buildDescriptors = (
	frameSystem: FrameSystemJson,
	contexts: Map<string, FrameContext>
): FrameDescriptor[] => {
	const descriptors: FrameDescriptor[] = []

	for (const [frameName, entry] of Object.entries(frameSystem.frames)) {
		const { parent, joint } = contexts.get(frameName)!

		switch (entry.frame_type) {
			// The arm's links and joints are already frames in their own right; a descriptor for
			// the model itself would draw the arm a second time, at the origin.
			case 'model': {
				continue
			}

			case 'named': {
				const outer = entry.frame as Record<string, unknown>
				const inner = outer.inner_frame as Record<string, unknown>
				const innerData = inner.frame as Record<string, unknown>

				if (inner.frame_type === 'rotational' || inner.frame_type === 'translational') {
					// A joint frame no model claims has no column in any step, so there is no value to
					// drive it. Dropping it leaves the rest of the plan viewable.
					if (!joint) continue

					descriptors.push({
						kind: 'joint',
						motion: inner.frame_type,
						name: frameName,
						parent,
						// Both marshal through `JointConfig`, so the axis reads the same either way.
						axis: innerData.axis as { X: number; Y: number; Z: number },
						componentName: joint.componentName,
						jointIndex: joint.jointIndex,
						mimic: joint.mimic,
						uuid: newUuid(),
					})
				} else if (inner.frame_type === 'static') {
					const framePose: FramePoseJson = {
						translation: innerData.translation as Vec3Json | undefined,
						orientation: innerData.orientation as RawOrientation | undefined,
					}
					descriptors.push({
						kind: 'static',
						name: frameName,
						parent,
						localPose: poseFromJson(framePose.translation, framePose.orientation),
						geometry: parseGeometry(innerData.geometry, frameName, framePose),
						uuid: newUuid(),
					})
				} else {
					warnUnhandledFrame(frameName, inner.frame_type)
				}
				break
			}

			case DECODED_FRAME_TYPE: {
				const { pose, geometry } = entry.frame as DecodedFrame
				descriptors.push({
					kind: 'static',
					name: frameName,
					parent,
					localPose: pose,
					geometry,
					uuid: newUuid(),
				})
				break
			}

			case 'tail_geometry_static':
			case 'static': {
				const frame = entry.frame as Record<string, unknown>
				descriptors.push({
					kind: 'static',
					name: frameName,
					parent,
					localPose: poseFromJson(
						frame.translation as Vec3Json | undefined,
						frame.orientation as RawOrientation | undefined
					),
					geometry: parseGeometry(frame.geometry, frameName),
					uuid: newUuid(),
				})
				break
			}

			default: {
				warnUnhandledFrame(frameName, entry.frame_type)
				break
			}
		}
	}

	return descriptors
}

export const buildFrameDescriptors = (frameSystem: FrameSystemJson): FrameDescriptor[] =>
	buildDescriptors(frameSystem, buildFrameContexts(frameSystem))
