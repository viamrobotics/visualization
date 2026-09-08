import { type Entity, Or, type World } from 'koota'
import { type Intersection, type Object3D, Vector3 } from 'three'

import { traits } from '$lib/ecs'

import { isUsableHit } from './cursor'

const SURFACE_TRAITS = Or(
	traits.Box,
	traits.Capsule,
	traits.Sphere,
	traits.Cylinder,
	traits.BufferGeometry
)

/** The gizmo-usable entity and world-space point of the nearest surface hit, or `undefined`. */
export const findSurfaceHit = (
	world: World,
	intersections: Intersection[]
): { entity: Entity; position: Vector3 } | undefined => {
	const surfaces = new Set(world.query(SURFACE_TRAITS))

	for (const hit of intersections) {
		if (!isUsableHit(hit)) continue
		const entity = findSurfaceAncestor(hit.object, surfaces)
		if (entity !== undefined) return { entity, position: hit.point.clone() }
	}

	return undefined
}

// Entity renderers stamp the Koota entity id into Object3D.name, so ancestry walks can
// compare it directly. Three types it as a string, but it holds the numeric entity id.
const findSurfaceAncestor = (object: Object3D, surfaces: Set<Entity>): Entity | undefined => {
	let current: Object3D | undefined = object
	while (current) {
		const name = current.name as unknown as Entity
		if (surfaces.has(name)) return name
		current = current.parent ?? undefined
	}

	return undefined
}
