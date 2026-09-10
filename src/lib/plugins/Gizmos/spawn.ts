import { type ConfigurableTrait, type Entity, type World } from 'koota'
import { Matrix4, type Vector3 } from 'three'

import { traits } from '$lib/ecs'

import * as gizmoTraits from './traits'

export const ARROW_COLOR = new Uint8Array([156, 39, 176])
export const REFERENCE_GEOMETRY_COLOR = new Uint8Array([124, 179, 66])
export const REFERENCE_GEOMETRY_OPACITY = 0.5
export const POLYLINE_COLOR = new Uint8Array([33, 150, 243])

interface GizmoSpec {
	kind: string
	traits: ConfigurableTrait[]
	matrix?: Matrix4
}

interface PendingGizmoSpec extends GizmoSpec {
	position: Vector3
}

/** Spawns a placed gizmo entity with the shared trait set plus its kind-specific traits. */
export const spawnGizmo = (world: World, spec: GizmoSpec) =>
	world.spawn(...commonTraits(world, spec), ...spec.traits)

/**
 * Spawns a gizmo that is still being placed. It is a real, rendered entity from the
 * start, tagged `PendingGizmo` so `confirmPending`/`cancelPending` can resolve it.
 */
export const spawnPending = (world: World, spec: PendingGizmoSpec) => {
	const matrix =
		spec.matrix ?? new Matrix4().setPosition(spec.position.x, spec.position.y, spec.position.z)

	return world.spawn(
		...commonTraits(world, { ...spec, matrix }),
		gizmoTraits.PendingGizmo,
		...spec.traits
	)
}

/** Drops the `PendingGizmo` tag, promoting a pending gizmo to a placed one. */
export const confirmPending = (entity: Entity) => {
	if (entity.isAlive() && entity.has(gizmoTraits.PendingGizmo)) {
		entity.remove(gizmoTraits.PendingGizmo)
	}
}

/** Destroys a pending gizmo. A no-op if it was already confirmed, destroyed, or never given. */
export const cancelPending = (entity: Entity | undefined) => {
	if (!entity) return
	if (!entity.isAlive()) return
	if (!entity.has(gizmoTraits.PendingGizmo)) return
	entity.destroy()
}

// O(n) over all named entities — acceptable because gizmo counts are small (< 100).
const nextIndex = (world: World, kind: string) => {
	const used = new Set<number>()
	for (const entity of world.query(traits.Name)) {
		const name = entity.get(traits.Name)
		if (!name?.startsWith(kind)) continue

		const n = Number(name.slice(kind.length))
		if (Number.isInteger(n) && n > 0) used.add(n)
	}

	let i = 1
	while (used.has(i)) i++
	return i
}

const commonTraits = (world: World, spec: GizmoSpec) => [
	traits.Name(`${spec.kind} ${nextIndex(world, spec.kind)}`),
	traits.Matrix(spec.matrix ?? new Matrix4()),
	traits.Removable,
	traits.Editable,
	traits.CustomDetails,
	traits.Gizmo,
]
