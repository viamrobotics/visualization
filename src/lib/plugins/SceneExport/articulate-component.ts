import { MathUtils, Matrix4, Vector3 } from 'three'

import { internalFrameName } from '$lib/kinematicsFrames'
import {
	isDHModel,
	type RawKinematicsJoint,
	type RawKinematicsModel,
} from '$lib/kinematicsTransform'
import { poseFromJson } from '$lib/math/spatialJson'

import type { SimBody, SimExportNote, SimJoint } from './sim-scene'

import { attachChildrenToEndEffector, mountedChildren } from './attach-to-end-effector'
import { recoverJointValue } from './recover-joint-value'

const MM_TO_M = 0.001

export interface ArticulationContext {
	bodiesByName: Map<string, SimBody>
	/** Claims a body name, suffixing it if another body already holds it. */
	nameFor: (wanted: string) => string
	/**
	 * A body's configured pose relative to its parent, unposed by any joint. `undefined` when the
	 * body has none, or when its entity's own parent was left out and the pose is from elsewhere.
	 */
	configPoseOf: (bodyName: string) => Matrix4 | undefined
	notes: SimExportNote[]
}

/** The joints between a link or joint and its nearest link ancestor, and that ancestor's id. */
interface JointsAbove {
	/** Nearest the ancestor first. */
	joints: RawKinematicsJoint[]
	parentLinkId: string | undefined
}

/** Joints in `chain`, as `SimJoint`s, at zero until a value is recovered. */
interface JointChain {
	joints: RawKinematicsJoint[]
	simJoints: SimJoint[]
	/** The body the first joint hangs off. */
	parentName: string
}

const axisOf = (joint: RawKinematicsJoint): Vector3 => {
	const axis = joint.axis ?? {}
	return new Vector3(
		axis.X ?? axis.x ?? 0,
		axis.Y ?? axis.y ?? 0,
		axis.Z ?? axis.z ?? 0
	).normalize()
}

const toSimJoint = (joint: RawKinematicsJoint): SimJoint | undefined => {
	if (joint.type !== 'revolute' && joint.type !== 'prismatic') return undefined
	const toSimUnits = joint.type === 'revolute' ? MathUtils.DEG2RAD : MM_TO_M
	const { min, max, max_velocity: maxVelocity } = joint
	const hasLimits = Number.isFinite(min) && Number.isFinite(max)
	return {
		type: joint.type,
		axis: axisOf(joint),
		limits: hasLimits
			? { lower: (min as number) * toSimUnits, upper: (max as number) * toSimUnits }
			: undefined,
		value: 0,
		maxVelocity: Number.isFinite(maxVelocity) ? (maxVelocity as number) * toSimUnits : undefined,
	}
}

const jointsAbove = (
	parentId: string | undefined,
	jointsById: Map<string, RawKinematicsJoint>
): JointsAbove => {
	const joints: RawKinematicsJoint[] = []
	let joint = parentId === undefined ? undefined : jointsById.get(parentId)

	while (joint && !joints.includes(joint)) {
		joints.unshift(joint)
		parentId = joint.parent
		joint = parentId === undefined ? undefined : jointsById.get(parentId)
	}

	return { joints, parentLinkId: parentId }
}

/** rdk's end effector: the first output frame, or the model's one leaf when none is named. */
const endEffectorId = (model: RawKinematicsModel): string | undefined => {
	const outputFrame = model.output_frames?.[0]
	if (outputFrame) return outputFrame

	const nodes = [...(model.links ?? []), ...(model.joints ?? [])]
	const parentIds = new Set(nodes.map((node) => node.parent))
	const leaves = nodes.filter((node) => !parentIds.has(node.id))
	return leaves.length === 1 ? leaves[0]?.id : undefined
}

/** `bodyName`'s pose in `componentName`'s frame, composed from the origins as they stand now. */
const poseInComponent = (
	bodyName: string,
	componentName: string,
	bodiesByName: Map<string, SimBody>
): Matrix4 | undefined => {
	const pose = new Matrix4()
	const seen = new Set<string>()
	let name: string | undefined = bodyName

	while (name !== componentName) {
		const body: SimBody | undefined = name === undefined ? undefined : bodiesByName.get(name)
		if (!body || seen.has(body.name)) return undefined
		seen.add(body.name)
		pose.premultiply(body.origin)
		name = body.parent
	}

	return pose
}

/**
 * Turns one component's link bodies into an articulated chain. Each joint becomes a body of its own,
 * hung off the parent link at the parent's origin, and the link hangs off it at the link's static
 * pose from the model. Frames parented to the component move onto its end effector. Returns the
 * joint bodies it added.
 *
 * The scene draws a link straight off its parent link and skips the joints, so this is the step that
 * puts them back.
 */
export const articulateComponent = (
	componentName: string,
	model: RawKinematicsModel,
	context: ArticulationContext
): SimBody[] => {
	const { bodiesByName, nameFor, configPoseOf, notes } = context
	if (isDHModel(model)) {
		notes.push({ reason: 'dh-model-not-articulated', subject: componentName })
		return []
	}

	const jointsById = new Map((model.joints ?? []).map((joint) => [joint.id, joint]))
	const linkIds = new Set((model.links ?? []).map((link) => link.id))
	const jointBodiesById = new Map<string, SimBody>()
	const added: SimBody[] = []

	// The same parent `deriveKinematicsFrames` gives a link's frame.
	const parentBodyName = (parentLinkId: string | undefined): string =>
		parentLinkId !== undefined && linkIds.has(parentLinkId)
			? internalFrameName(componentName, parentLinkId)
			: componentName

	// One `SimJoint` per joint, so a value recovered through either of two sibling branches reaches
	// the body both share.
	const simJointsById = new Map<string, SimJoint | undefined>()
	const simJointFor = (joint: RawKinematicsJoint): SimJoint | undefined => {
		if (!simJointsById.has(joint.id)) simJointsById.set(joint.id, toSimJoint(joint))
		return simJointsById.get(joint.id)
	}
	const recoveredJointIds = new Set<string>()

	const toJointChain = (
		joints: RawKinematicsJoint[],
		parentName: string
	): JointChain | undefined => {
		const simJoints = joints.map((joint) => simJointFor(joint))
		if (simJoints.includes(undefined)) return undefined
		return { joints, simJoints: simJoints as SimJoint[], parentName }
	}

	/** Hangs the chain's joint bodies in order, reusing any a sibling branch built. Returns the last. */
	const buildJointBodies = ({ joints, simJoints, parentName }: JointChain): string => {
		let parent = parentName
		for (const [index, joint] of joints.entries()) {
			let body = jointBodiesById.get(joint.id)
			if (!body) {
				body = {
					name: nameFor(internalFrameName(componentName, joint.id)),
					parent,
					origin: new Matrix4(),
					joint: simJoints[index],
					geoms: [],
				}
				jointBodiesById.set(joint.id, body)
				added.push(body)
			}
			parent = body.name
		}
		return parent
	}

	/**
	 * Sets the chain's joint from a pose measured through it. Only a chain of one joint can be
	 * solved. Joints left unsolved are noted once every branch has had its try.
	 */
	const recoverChainValue = (
		chain: JointChain,
		childInParent: Matrix4 | undefined,
		childStatic: Matrix4 | undefined
	) => {
		const [joint] = chain.joints
		const [simJoint] = chain.simJoints
		if (chain.joints.length !== 1 || !joint || !simJoint || !childInParent || !childStatic) return
		const value = recoverJointValue(simJoint, childInParent, childStatic)
		if (value === undefined) return
		simJoint.value = value
		recoveredJointIds.add(joint.id)
	}

	// A joint end effector has no link below it, so its angle can only come from a frame mounted on
	// it. That frame's scene pose is relative to the component, so it is read before links move.
	const endEffector = endEffectorId(model)
	const endEffectorJoint = endEffector === undefined ? undefined : jointsById.get(endEffector)
	let endEffectorChain: JointChain | undefined
	if (endEffectorJoint) {
		const { joints, parentLinkId } = jointsAbove(endEffectorJoint.parent, jointsById)
		const parentName = parentBodyName(parentLinkId)
		endEffectorChain = bodiesByName.has(parentName)
			? toJointChain([...joints, endEffectorJoint], parentName)
			: undefined
	}
	if (endEffectorChain && endEffectorJoint) {
		const { parentName } = endEffectorChain
		const parentInComponent =
			parentName === componentName
				? new Matrix4()
				: poseInComponent(parentName, componentName, bodiesByName)
		const mounted = mountedChildren(componentName, bodiesByName).find((child) =>
			configPoseOf(child.name)
		)
		recoverChainValue(
			endEffectorChain,
			mounted && parentInComponent?.clone().invert().multiply(mounted.origin),
			mounted && configPoseOf(mounted.name)
		)
	}

	for (const link of model.links ?? []) {
		const linkBody = bodiesByName.get(internalFrameName(componentName, link.id))
		if (!linkBody) continue

		const { joints, parentLinkId } = jointsAbove(link.parent, jointsById)
		if (joints.length === 0) continue

		const parentName = parentBodyName(parentLinkId)
		const chain = toJointChain(joints, parentName)
		// A parent mismatch means the scene moved the link, and its pose no longer composes with the
		// joints. Either way the link stays welded where the scene shows it.
		if (!chain || linkBody.parent !== parentName) {
			notes.push({ reason: 'link-not-articulated', subject: linkBody.name })
			continue
		}

		const linkStatic = poseFromJson(link.translation, link.orientation).toMatrix4()
		recoverChainValue(chain, linkBody.origin, linkStatic)
		linkBody.parent = buildJointBodies(chain)
		linkBody.origin = linkStatic
	}

	let endEffectorName: string | undefined
	if (endEffectorChain) {
		endEffectorName = buildJointBodies(endEffectorChain)
	} else if (endEffector !== undefined && linkIds.has(endEffector)) {
		const linkName = internalFrameName(componentName, endEffector)
		endEffectorName = bodiesByName.has(linkName) ? linkName : undefined
	}

	attachChildrenToEndEffector(componentName, endEffectorName, context)

	for (const [jointId, body] of jointBodiesById) {
		if (!recoveredJointIds.has(jointId)) {
			notes.push({ reason: 'joint-value-unknown', subject: body.name })
		}
	}

	return added
}
