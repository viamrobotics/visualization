/**
 * Which slot of a trajectory step drives each joint of one model. `NewModelWithMimics`: walk
 * `bfsFrameNames` breadth-first, skip any frame with a mimic mapping, give each survivor a slot.
 */

/** The root of a model's *internal* frame system — its own mount, not the scene root. */
const MODEL_ROOT = 'world'

/** Only the fields that decide a column. The rest of `JointConfig` is read where the frame is built. */
interface MimicJson {
	joint?: string
	multiplier?: number
	offset?: number
}

/**
 * Both fields are Go `string`s on `LinkConfig` and `JointConfig`, so the only absent value that can
 * reach here is a missing key or the empty string, never a number. Both mean "unnamed".
 */
export interface ModelNodeJson {
	id?: string
	parent?: string
}

export interface JointJson extends ModelNodeJson {
	mimic?: MimicJson
}

/** The members of a model config that decide the chain. */
export interface ModelJson {
	links?: ModelNodeJson[]
	joints?: JointJson[]
	/**
	 * Not read here. `modelOutputFrame` in `frameDescriptors.ts` is the reader; declared so a model
	 * with more than one leaf, which RDK refuses to build without it, can be written down.
	 */
	output_frames?: string[]
}

/**
 * An unnamed node cannot be addressed, so it is dropped from the tree rather than joined into it:
 * left in, every one of them collides on the same empty key and claims the others' children.
 */
export const nodeName = (value: string | undefined): string | undefined =>
	value === undefined || value === '' ? undefined : value

export interface JointColumn {
	/** Index into this model's slice of a trajectory step. */
	index: number
	/**
	 * Present iff the joint mimics another, in which case `index` addresses its *source* and the value
	 * to use is `multiplier * step[index] + offset`, as RDK derives it.
	 */
	mimic?: { multiplier: number; offset: number }
}

export interface ModelJointColumns {
	/**
	 * Every joint id in schema order, mimics included: a mimic owns a frame but no column, and the
	 * last entry is where a model with no declared end effector hangs its tool.
	 */
	order: string[]
	/** Keyed by joint id. A joint missing from this has no value to render — see below for why. */
	columns: Map<string, JointColumn>
}

/** RDK reads a zero multiplier as "unset" and substitutes 1 (`MimicConfig.EffectiveMultiplier`). */
const multiplierOf = (mimic: MimicJson): number => mimic.multiplier || 1

/**
 * Follows `a mimics b mimics c` down to the joint that owns a column, composing the linear maps as it
 * goes: `a = m₁(m₂c + o₂) + o₁`. Returns nothing for a cycle, which has no such joint at the bottom.
 */
const resolveMimic = (
	jointId: string,
	mimics: Map<string, MimicJson>
): { source: string; multiplier: number; offset: number } | undefined => {
	const own = mimics.get(jointId)!
	const visited = new Set([jointId])

	let multiplier = multiplierOf(own)
	let offset = own.offset ?? 0
	let source = own.joint ?? ''

	for (let next = mimics.get(source); next !== undefined; next = mimics.get(source)) {
		if (visited.has(source)) return undefined
		visited.add(source)

		offset += multiplier * (next.offset ?? 0)
		multiplier *= multiplierOf(next)
		source = next.joint ?? ''
	}

	return { source, multiplier, offset }
}

/**
 * Keyed by joint id, not frame name: the `${model}:${id}` join belongs to the caller that knows the
 * model's name. `modelName` is read only to name the model in the one warning below.
 */
export const modelJointColumns = (
	model: ModelJson | undefined,
	modelName: string
): ModelJointColumns => {
	// `Array.isArray`, not `??`: a malformed capture can declare these as `{}`, and spreading a
	// non-iterable throws, taking the whole plan render down.
	const rawLinks = model?.links
	const rawJoints = model?.joints
	const links = Array.isArray(rawLinks) ? rawLinks : []
	const joints = Array.isArray(rawJoints) ? rawJoints : []

	const mimics = new Map<string, MimicJson>()
	const jointIds: string[] = []
	for (const joint of joints) {
		const id = nodeName(joint.id)
		if (id === undefined) continue
		jointIds.push(id)
		if (joint.mimic) mimics.set(id, joint.mimic)
	}
	const isJoint = new Set(jointIds)

	const nodes = [...links, ...joints]
	const declared = new Set(nodes.map((node) => nodeName(node.id)).filter((id) => id !== undefined))

	const childrenOf = new Map<string, string[]>()
	for (const node of nodes) {
		const id = nodeName(node.id)
		if (id === undefined) continue

		// RDK roots a node whose parent is not itself declared, not only one naming no parent:
		// `buildModelFrameSystem` queues those onto `fs.World()`, so an unknown parent still holds a
		// real place in the walk.
		const named = nodeName(node.parent)
		const parent = named !== undefined && declared.has(named) ? named : MODEL_ROOT

		const siblings = childrenOf.get(parent)
		if (siblings) siblings.push(id)
		else childrenOf.set(parent, [id])
	}
	for (const siblings of childrenOf.values()) siblings.sort()

	const order: string[] = []
	const seen = new Set<string>()
	const queue = [MODEL_ROOT]
	while (queue.length > 0) {
		const current = queue.shift()!
		if (seen.has(current)) continue
		seen.add(current)
		if (isJoint.has(current)) order.push(current)
		queue.push(...(childrenOf.get(current) ?? []))
	}

	// Only a parent cycle can strand a joint, and RDK refuses to build one (`ErrCircularReference`).
	// Kept because dropping the joint would silently take its whole subtree out of the drawing.
	const unreached = jointIds.filter((id) => !seen.has(id))
	if (unreached.length > 0) {
		console.warn(
			`[motion] joints ${unreached.join(', ')} on "${modelName}" are not connected to its base — their trajectory columns are a guess`
		)
		order.push(...unreached)
	}

	const columns = new Map<string, JointColumn>()
	let index = 0
	for (const id of order) {
		if (!mimics.has(id)) columns.set(id, { index: index++ })
	}

	for (const id of mimics.keys()) {
		const resolved = resolveMimic(id, mimics)
		const source = resolved && columns.get(resolved.source)

		// A cycle, or a source that is absent or has no column. RDK refuses to build such a model, so
		// this needs hand-written config; leaving the joint undrawn beats driving it off an unrelated
		// column.
		if (!resolved || !source) continue

		columns.set(id, {
			index: source.index,
			mimic: { multiplier: resolved.multiplier, offset: resolved.offset },
		})
	}

	return { order, columns }
}
