import type { Joint, KinematicsSpec, Link } from '$lib/buf/kinematics/v1/spec_pb'

export type KinematicsItem =
	| { kind: 'root' }
	| { kind: 'link'; link: Link }
	| { kind: 'joint'; joint: Joint }
	| { kind: 'tcp' }
	| { kind: 'visual'; link: Link }

const VISUAL_SUFFIX = ' visual'

/**
 * The definition item an entity named `name` shows, using the frame tree's reference frames: the
 * spec name is the model, a link id a link, a joint id a joint, `tcp` the TCP frame, and
 * `<link id> visual` a link's full-detail mesh.
 *
 * @returns `undefined` for a name that is none of those, such as a ghost of a previous build.
 */
export const kinematicsItem = (spec: KinematicsSpec, name: string): KinematicsItem | undefined => {
	if (name === 'root') return { kind: 'root' }
	if (name === 'tcp') return { kind: 'tcp' }
	const link = spec.links.find((candidate) => candidate.id === name)
	if (link) return { kind: 'link', link }
	const joint = spec.joints.find((candidate) => candidate.id === name)
	if (joint) return { kind: 'joint', joint }
	if (!name.endsWith(VISUAL_SUFFIX)) return undefined
	const owner = spec.links.find(
		(candidate) => candidate.id === name.slice(0, -VISUAL_SUFFIX.length)
	)
	return owner ? { kind: 'visual', link: owner } : undefined
}
