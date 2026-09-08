import type { World } from 'koota'

import { traits } from '$lib/ecs'
import { getParentName } from '$lib/ecs/hierarchy'

import { GIZMO_STORE_VERSION, type GizmoRecord, type GizmoStore } from './gizmoRecord'
import { AngleMeasure, PolylineMeasure, ReferencePlane } from './traits'

const colorToBytes = (color: { r: number; g: number; b: number }): [number, number, number] => [
	Math.round(color.r * 255),
	Math.round(color.g * 255),
	Math.round(color.b * 255),
]

const commonFields = (entity: import('koota').Entity) => {
	const matrix = entity.get(traits.Matrix)!
	const record: {
		name: string
		matrix: number[]
		parent?: string
		color?: [number, number, number]
		opacity?: number
		showAxesHelper?: boolean
	} = {
		name: entity.get(traits.Name) ?? '',
		matrix: [...matrix.elements],
	}

	const parent = getParentName(entity)
	if (parent !== undefined) record.parent = parent

	if (entity.has(traits.Color)) record.color = colorToBytes(entity.get(traits.Color)!)
	if (entity.has(traits.Opacity)) record.opacity = entity.get(traits.Opacity)

	if (entity.has(traits.ShowAxesHelper)) {
		record.showAxesHelper = entity.get(traits.ShowAxesHelper)
	}

	return record
}

const serializeLineFields = (entity: import('koota').Entity) => {
	const positions = entity.get(traits.LinePositions)
	const dotColors = entity.get(traits.DotColors)

	return {
		positions: positions ? [...positions] : [],
		lineWidth: entity.get(traits.LineWidth) ?? 0,
		dotSize: entity.get(traits.DotSize) ?? 0,
		...(dotColors && dotColors.length > 0 ? { dotColors: [...dotColors] } : {}),
	}
}

/** Builds one `GizmoRecord`, or `undefined` if the entity has no kind this format recognizes. */
const serializeGizmo = (entity: import('koota').Entity): GizmoRecord | undefined => {
	const base = commonFields(entity)

	if (entity.has(traits.ReferenceFrame)) {
		return { ...base, kind: 'coordinate-system' }
	}

	if (entity.has(ReferencePlane)) {
		const plane = entity.get(ReferencePlane)!
		return {
			...base,
			kind: 'reference-plane',
			width: plane.width,
			height: plane.height,
			axis: plane.axis,
		}
	}

	if (entity.has(traits.Box)) {
		const box = entity.get(traits.Box)!
		return {
			...base,
			kind: 'reference-geometry',
			shape: { type: 'box', x: box.x, y: box.y, z: box.z },
			...(entity.has(traits.Wireframe) ? { wireframe: true } : {}),
		}
	}

	if (entity.has(traits.Sphere)) {
		const sphere = entity.get(traits.Sphere)!
		return {
			...base,
			kind: 'reference-geometry',
			shape: { type: 'sphere', r: sphere.r },
			...(entity.has(traits.Wireframe) ? { wireframe: true } : {}),
		}
	}

	if (entity.has(traits.Capsule)) {
		const capsule = entity.get(traits.Capsule)!
		return {
			...base,
			kind: 'reference-geometry',
			shape: { type: 'capsule', l: capsule.l, r: capsule.r },
			...(entity.has(traits.Wireframe) ? { wireframe: true } : {}),
		}
	}

	if (entity.has(traits.Arrow)) {
		return { ...base, kind: 'arrow' }
	}

	if (entity.has(AngleMeasure)) {
		return { ...base, kind: 'angle', ...serializeLineFields(entity) }
	}

	if (entity.has(traits.LinePositions)) {
		const measure = entity.has(PolylineMeasure) ? entity.get(PolylineMeasure)!.mode : undefined
		return {
			...base,
			kind: 'polyline',
			...serializeLineFields(entity),
			...(entity.has(traits.ScreenSpace) ? { screenSpace: true } : {}),
			...(measure ? { measure } : {}),
		}
	}

	return undefined
}

/**
 * Serializes every `traits.Gizmo` entity in `world` into a storable payload at the
 * current format version. Entities whose kind this format does not recognize are
 * skipped rather than failing the whole store.
 */
export const serializeGizmos = (world: World): GizmoStore => {
	const gizmos: GizmoRecord[] = []

	for (const entity of world.query(traits.Gizmo)) {
		const record = serializeGizmo(entity)
		if (record) gizmos.push(record)
	}

	return { version: GIZMO_STORE_VERSION, gizmos }
}
