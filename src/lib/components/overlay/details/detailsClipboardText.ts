import type { Entity } from 'koota'

import { hierarchy, traits } from '#lib/ecs/index.js'

import { composeDisplayedPose } from './composeDisplayedPose'

const geometryOf = (entity: Entity) => {
	const box = entity.get(traits.Box)
	if (box) return { type: 'box', value: box }

	const sphere = entity.get(traits.Sphere)
	if (sphere) return { type: 'sphere', value: sphere }

	const capsule = entity.get(traits.Capsule)
	if (capsule) return { type: 'capsule', value: capsule }

	const cylinder = entity.get(traits.Cylinder)
	if (cylinder) return { type: 'cylinder', value: cylinder }

	return { type: 'none', value: undefined }
}

const detailsOf = (entity: Entity) => {
	// A frame's displayed pose is its origin. Other entities fold their geometry center in.
	const center = entity.has(traits.FramesAPI) ? undefined : entity.get(traits.Center)
	const localPose = composeDisplayedPose(
		entity.get(traits.EditedMatrix) ?? entity.get(traits.Matrix),
		center
	)
	const worldMatrix = entity.get(traits.WorldMatrix)
	const worldPose = worldMatrix ? composeDisplayedPose(worldMatrix, center) : undefined

	return {
		worldPosition: worldPose ? { x: worldPose.x, y: worldPose.y, z: worldPose.z } : null,
		worldOrientation: worldPose
			? { x: worldPose.oX, y: worldPose.oY, z: worldPose.oZ, th: worldPose.theta }
			: null,
		localPosition: { x: localPose?.x, y: localPose?.y, z: localPose?.z },
		localOrientation: {
			x: localPose?.oX,
			y: localPose?.oY,
			z: localPose?.oZ,
			th: localPose?.theta,
		},
		geometry: geometryOf(entity),
		parentFrame: hierarchy.getParentName(entity) ?? 'world',
	}
}

/**
 * The details panel's copy-to-clipboard text, as pretty-printed JSON. One entity copies
 * as an object, several as an array of objects that each carry the entity's name.
 */
export const detailsClipboardText = (entities: readonly Entity[]): string => {
	const [only] = entities
	const payload =
		entities.length === 1 && only
			? detailsOf(only)
			: entities.map((entity) => ({ name: entity.get(traits.Name), ...detailsOf(entity) }))

	return JSON.stringify(payload, null, 2)
}
