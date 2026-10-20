/**
 * Reconstructs the frames rdk derives from a component's kinematics, so the
 * scene can be composed from one `frameSystemConfig` fetch instead of polling
 * `getGeometries` for collision meshes that never change.
 *
 * Mirrors the flattened model internals of `referenceframe.createFramesFromPart`,
 * contributing only the links:
 *
 * ```
 * <name>          the component's own frame, already in the scene from config
 * └── <name>:<id> the model's links, namespaced, hanging off it
 * ```
 *
 * rdk splits that root in two — `<name>_origin` for the mount and `<name>` for
 * the end effector — but the scene keeps one node per component, because
 * `<name>` is the key the part config and the whole editing layer address a
 * frame by. `_origin` survives only as the name {@link originFrameName} builds
 * for the pose query; see `usePoses`.
 */

import type { Transform } from '$lib/geometry'
import type { Pose } from '$lib/math'

import {
	isDHModel,
	parseKinematicsGeometry,
	type RawKinematicsLink,
	type RawKinematicsModel,
} from '$lib/kinematicsTransform'
import { poseFromJson } from '$lib/math/spatialJson'

/** rdk's name for a component's mount. The bare name resolves to the end effector. */
export const originFrameName = (componentName: string): string => `${componentName}_origin`

/** rdk namespaces a model's internal frames with the owning component. */
export const internalFrameName = (componentName: string, id: string): string =>
	`${componentName}:${id}`

/**
 * The component a namespaced internal frame belongs to, or `undefined` for a
 * frame that isn't one. Component names cannot contain a colon, so the first one
 * is the separator.
 */
export const ownerOfInternalFrame = (frameName: string): string | undefined => {
	const colon = frameName.indexOf(':')
	return colon === -1 ? undefined : frameName.slice(0, colon)
}

interface KinematicNode {
	id: string
	parent?: string
	isLink: boolean
}

/** Derived frames carry no server-assigned identity; only world-state transforms do. */
const NO_UUID = new Uint8Array(0)

const transform = (
	name: string,
	parentName: string,
	pose: Pose,
	physicalObject?: Transform['physicalObject']
): Transform => ({
	uuid: NO_UUID,
	referenceFrame: name,
	poseInObserverFrame: { referenceFrame: parentName, pose },
	physicalObject,
})

/**
 * The nearest ancestor that is a link.
 *
 * Only links become frames here — a joint has no geometry, and its pose is
 * redundant once each link is resolved against its nearest link ancestor. At
 * zero configuration a joint contributes no offset, so skipping it leaves the
 * baseline pose intact; the live pose comes from `getPose` against this same
 * parent, which keeps the composition exact either way.
 *
 * `seen` guards a malformed model whose parent chain loops back on itself.
 */
const nearestLinkAncestor = (
	link: RawKinematicsLink,
	nodes: Record<string, KinematicNode>
): KinematicNode | undefined => {
	let parent = link.parent === undefined ? undefined : nodes[link.parent]
	const seen = new Set<string>()

	while (parent && !parent.isLink) {
		if (seen.has(parent.id)) {
			return undefined
		}
		seen.add(parent.id)
		parent = parent.parent === undefined ? undefined : nodes[parent.parent]
	}

	return parent
}

/**
 * Build the link frames for one component, hung off the component's own frame.
 * That frame is not among them; config already put it in the scene.
 */
export const deriveKinematicsFrames = (
	componentName: string,
	model: RawKinematicsModel
): Transform[] => {
	const frames: Transform[] = []

	// A DH model has no links to derive. Warn rather than return quietly: the
	// difference between a component that is visibly bare and one that is missing.
	if (isDHModel(model)) {
		console.warn(
			`[kinematics] "${componentName}" is a DH-parameter model; its geometries cannot be derived from the frame system`
		)
		return frames
	}

	const links = model.links ?? []
	// Scoped per component: two arms of the same model share link ids.
	const nodes: Record<string, KinematicNode> = {}
	for (const link of links) {
		nodes[link.id] = { id: link.id, parent: link.parent, isLink: true }
	}
	for (const joint of model.joints ?? []) {
		nodes[joint.id] = { id: joint.id, parent: joint.parent, isLink: false }
	}

	for (const link of links) {
		const frameName = internalFrameName(componentName, link.id)
		const linkPose = { translation: link.translation, orientation: link.orientation }
		const pose = poseFromJson(link.translation, link.orientation)

		const parent = nearestLinkAncestor(link, nodes)
		const parentFrameName = parent ? internalFrameName(componentName, parent.id) : componentName

		frames.push(
			transform(
				frameName,
				parentFrameName,
				pose,
				// The link's own pose is what turns the geometry's parent-relative
				// offset into a link-local one.
				link.geometry ? parseKinematicsGeometry(link.geometry, linkPose) : undefined
			)
		)
	}

	return frames
}
