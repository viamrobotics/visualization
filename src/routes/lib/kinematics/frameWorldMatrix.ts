import { Matrix4 } from 'three'

import type { Transform } from '$lib/buf/common/v1/common_pb'

import { Pose as PoseMath } from '$lib/math/pose'

/**
 * The world matrix, in metres, of the frame `name` in a parent-relative frame tree: each frame's
 * `poseInObserverFrame.pose` composed up its parents until a parent the tree does not hold, such as
 * `world`.
 *
 * @returns `undefined` for a `name` no frame carries.
 * @throws For a parent chain that loops.
 */
export const frameWorldMatrix = (
	transforms: readonly Transform[],
	name: string
): Matrix4 | undefined => {
	const byName = new Map(transforms.map((transform) => [transform.referenceFrame, transform]))
	const visited = new Set<string>()
	let current = byName.get(name)
	if (!current) return undefined

	const world = new Matrix4()
	let currentName = name
	while (current) {
		if (visited.has(currentName)) throw new Error(`frame "${currentName}" is its own ancestor`)
		visited.add(currentName)
		const pose = current.poseInObserverFrame?.pose
		if (pose) world.premultiply(new PoseMath().copy(pose).toMatrix4())
		currentName = current.poseInObserverFrame?.referenceFrame ?? ''
		current = byName.get(currentName)
	}
	return world
}
