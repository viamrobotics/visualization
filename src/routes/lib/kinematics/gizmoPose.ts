import type { PlainMessage } from '@bufbuild/protobuf'
import type { Matrix4 } from 'three'

import type { Pose, Transform } from '$lib/buf/common/v1/common_pb'
import type { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import type { KinematicsItem } from './kinematicsItem'

import { frameWorldMatrix } from './frameWorldMatrix'
import { toAssembly, toLocal } from './localPose'
import { matrixToPose, poseToMatrix } from './poseMatrix'

/** The definition items a gizmo can place. `root` and visual meshes have no pose of their own. */
export type PlaceableItem = Extract<KinematicsItem, { kind: 'link' | 'joint' | 'tcp' }>

const ROOT_FRAME = 'root'
const TCP_FRAME = 'tcp'

const parentFrame = (parent: string): string => (parent === '' ? ROOT_FRAME : parent)

/** The scene frame `item` renders as: a link or joint by its id, the TCP as `tcp`. */
const itemFrame = (item: PlaceableItem): string => {
	switch (item.kind) {
		case 'link': {
			return item.link.id
		}
		case 'joint': {
			return item.joint.id
		}
		case 'tcp': {
			return TCP_FRAME
		}
		default: {
			const unreachable: never = item
			return unreachable
		}
	}
}

const placement = (
	spec: KinematicsSpec,
	item: PlaceableItem
): { parent: string; pose: PlainMessage<Pose> | undefined } => {
	switch (item.kind) {
		case 'link': {
			return { parent: item.link.parent, pose: item.link.origin }
		}
		case 'joint': {
			return { parent: item.joint.parent, pose: item.joint.origin }
		}
		case 'tcp': {
			return { parent: spec.tcpParent, pose: spec.tcpPose }
		}
		default: {
			const unreachable: never = item
			return unreachable
		}
	}
}

/**
 * Where the gizmo sits for `item`, in world space and metres, at the joint positions `transforms`
 * were posed at: the item's origin relative to its parent, under the parent frame's current world
 * matrix. A joint's gizmo sits at its origin before its own motion, so it reads the same as the
 * joint's Origin fields.
 *
 * @returns `undefined` while `transforms` hold no frame for the item's parent.
 */
export const gizmoWorldMatrix = (
	spec: KinematicsSpec,
	transforms: readonly Transform[],
	item: PlaceableItem
): Matrix4 | undefined => {
	const { parent, pose } = placement(spec, item)
	const parentWorld = frameWorldMatrix(transforms, parentFrame(parent))
	if (!parentWorld) return undefined
	return parentWorld.multiply(poseToMatrix(toLocal(spec, parent, pose)))
}

/**
 * The assembly-frame pose to write for `item` when the gizmo is released at `worldMatrix`: the matrix
 * relative to the parent frame at the current joint positions, then `toAssembly`. The inverse of
 * `gizmoWorldMatrix`.
 *
 * @returns `undefined` while `transforms` hold no frame for the item's parent.
 */
export const gizmoToAssembly = (
	spec: KinematicsSpec,
	transforms: readonly Transform[],
	item: PlaceableItem,
	worldMatrix: Matrix4
): PlainMessage<Pose> | undefined => {
	const { parent } = placement(spec, item)
	const parentWorld = frameWorldMatrix(transforms, parentFrame(parent))
	if (!parentWorld) return undefined
	const local = parentWorld.invert().multiply(worldMatrix)
	return toAssembly(spec, parent, matrixToPose(local))
}

/**
 * The local matrix, in metres, that previews `item`'s scene frame mid-drag: the gizmo's world change
 * from `dragStart` to `dragNow`, applied to the frame where `transforms` place it. A joint's frame
 * keeps its own motion, so a posed joint previews where its release will land.
 *
 * @returns `undefined` while `transforms` hold no frame for the item or its parent.
 */
export const dragPreviewMatrix = (
	spec: KinematicsSpec,
	transforms: readonly Transform[],
	item: PlaceableItem,
	dragStart: Matrix4,
	dragNow: Matrix4
): Matrix4 | undefined => {
	const parentWorld = frameWorldMatrix(transforms, parentFrame(placement(spec, item).parent))
	const itemWorld = frameWorldMatrix(transforms, itemFrame(item))
	if (!parentWorld || !itemWorld) return undefined
	const dragDelta = dragNow.clone().multiply(dragStart.clone().invert())
	return parentWorld.invert().multiply(dragDelta).multiply(itemWorld)
}
