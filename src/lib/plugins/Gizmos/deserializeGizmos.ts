import type { ConfigurableTrait, Entity, World } from 'koota'

import { Matrix4 } from 'three'

import { traits } from '$lib/ecs'
import { setParent } from '$lib/ecs/hierarchy'

import type { PlaneAxis } from './gizmos'

import { GIZMO_STORE_VERSION, type GizmoRecord } from './gizmoRecord'
import { spawnGizmo } from './spawn'
import { AngleMeasure, PolylineMeasure, ReferencePlane } from './traits'

const MATRIX_ELEMENT_COUNT = 16
const RGB_BYTE_COUNT = 3

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const isNumberArray = (value: unknown): value is number[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'number')

const isValidBase = (raw: Record<string, unknown>): boolean =>
	typeof raw.name === 'string' &&
	isNumberArray(raw.matrix) &&
	raw.matrix.length === MATRIX_ELEMENT_COUNT &&
	(raw.parent === undefined || typeof raw.parent === 'string') &&
	(raw.opacity === undefined || typeof raw.opacity === 'number') &&
	(raw.showAxesHelper === undefined || typeof raw.showAxesHelper === 'boolean') &&
	(raw.color === undefined || (isNumberArray(raw.color) && raw.color.length === RGB_BYTE_COUNT))

const isValidLineFields = (raw: Record<string, unknown>): boolean =>
	isNumberArray(raw.positions) && typeof raw.lineWidth === 'number'

const isValidDotFields = (raw: Record<string, unknown>): boolean =>
	typeof raw.dotSize === 'number' && (raw.dotColors === undefined || isNumberArray(raw.dotColors))

/** Narrows an unknown value parsed from storage into a `GizmoRecord`, or `undefined`. */
const parseGizmoRecord = (raw: unknown): GizmoRecord | undefined => {
	if (!isRecord(raw) || !isValidBase(raw)) return undefined

	const base = raw as Record<string, unknown> & {
		name: string
		matrix: number[]
		parent?: string
		color?: [number, number, number]
		opacity?: number
		showAxesHelper?: boolean
	}

	switch (raw.kind) {
		case 'coordinate-system':
		case 'arrow': {
			return { ...base, kind: raw.kind }
		}
		case 'reference-plane': {
			if (
				typeof raw.width !== 'number' ||
				typeof raw.height !== 'number' ||
				(raw.axis !== 'yz' && raw.axis !== 'xz' && raw.axis !== 'xy')
			) {
				return undefined
			}
			return {
				...base,
				kind: 'reference-plane',
				width: raw.width,
				height: raw.height,
				axis: raw.axis,
			}
		}
		case 'reference-geometry': {
			const shape = raw.shape
			if (!isRecord(shape)) return undefined

			if (shape.type === 'box' && [shape.x, shape.y, shape.z].every((v) => typeof v === 'number')) {
				return {
					...base,
					kind: 'reference-geometry',
					shape: { type: 'box', x: shape.x as number, y: shape.y as number, z: shape.z as number },
					...(typeof raw.wireframe === 'boolean' ? { wireframe: raw.wireframe } : {}),
				}
			}
			if (shape.type === 'sphere' && typeof shape.r === 'number') {
				return {
					...base,
					kind: 'reference-geometry',
					shape: { type: 'sphere', r: shape.r },
					...(typeof raw.wireframe === 'boolean' ? { wireframe: raw.wireframe } : {}),
				}
			}
			if (shape.type === 'capsule' && typeof shape.l === 'number' && typeof shape.r === 'number') {
				return {
					...base,
					kind: 'reference-geometry',
					shape: { type: 'capsule', l: shape.l, r: shape.r },
					...(typeof raw.wireframe === 'boolean' ? { wireframe: raw.wireframe } : {}),
				}
			}
			return undefined
		}
		case 'polyline': {
			if (!isValidLineFields(raw) || !isValidDotFields(raw)) return undefined
			return {
				...base,
				kind: 'polyline',
				positions: raw.positions as number[],
				lineWidth: raw.lineWidth as number,
				dotSize: raw.dotSize as number,
				...(raw.dotColors ? { dotColors: raw.dotColors as number[] } : {}),
				...(typeof raw.screenSpace === 'boolean' ? { screenSpace: raw.screenSpace } : {}),
				...(raw.lineMeasure === 'segment' || raw.lineMeasure === 'total'
					? { lineMeasure: raw.lineMeasure }
					: {}),
			}
		}
		case 'angle': {
			if (!isValidLineFields(raw)) return undefined
			return {
				...base,
				kind: 'angle',
				positions: raw.positions as number[],
				lineWidth: raw.lineWidth as number,
			}
		}
		default: {
			return undefined
		}
	}
}

const bytesToColor = ([r, g, b]: [number, number, number]) => ({
	r: r / 255,
	g: g / 255,
	b: b / 255,
})

/** Traits every gizmo may carry, built from the fields `GizmoRecordBase` defines. */
const commonTraits = (record: GizmoRecord): ConfigurableTrait[] => [
	...(record.color ? [traits.Color(bytesToColor(record.color))] : []),
	...(record.opacity === undefined ? [] : [traits.Opacity(record.opacity)]),
]

const kindTraits = (record: GizmoRecord): ConfigurableTrait[] => {
	switch (record.kind) {
		case 'coordinate-system': {
			return [
				traits.ReferenceFrame,
				...(record.showAxesHelper === undefined
					? []
					: [traits.ShowAxesHelper(record.showAxesHelper)]),
			]
		}
		case 'reference-plane': {
			return [
				ReferencePlane({
					width: record.width,
					height: record.height,
					axis: record.axis as PlaneAxis,
				}),
				...(record.showAxesHelper === undefined
					? []
					: [traits.ShowAxesHelper(record.showAxesHelper)]),
			]
		}
		case 'reference-geometry': {
			const shapeTrait =
				record.shape.type === 'box'
					? traits.Box({ x: record.shape.x, y: record.shape.y, z: record.shape.z })
					: record.shape.type === 'sphere'
						? traits.Sphere({ r: record.shape.r })
						: traits.Capsule({ l: record.shape.l, r: record.shape.r })
			return [shapeTrait, ...(record.wireframe ? [traits.Wireframe] : [])]
		}
		case 'arrow': {
			return [traits.Arrow]
		}
		case 'polyline': {
			return [
				traits.LinePositions(new Float32Array(record.positions)),
				traits.LineWidth(record.lineWidth),
				traits.DotSize(record.dotSize),
				...(record.dotColors ? [traits.DotColors(new Uint8Array(record.dotColors))] : []),
				...(record.screenSpace ? [traits.ScreenSpace] : []),
				...(record.lineMeasure ? [PolylineMeasure({ mode: record.lineMeasure })] : []),
			]
		}
		case 'angle': {
			return [
				traits.LinePositions(new Float32Array(record.positions)),
				traits.LineWidth(record.lineWidth),
				AngleMeasure,
			]
		}
		default: {
			const exhaustive: never = record
			return exhaustive
		}
	}
}

/**
 * Restores every gizmo in `store` into `world`, spawning through `spawnGizmo` so a
 * restored gizmo carries the same trait set as one placed by hand. Discards the whole
 * store without throwing when `store.version` does not match `GIZMO_STORE_VERSION`, and
 * skips any single record this build cannot parse rather than aborting the rest — a
 * malformed record does not cost the user every other gizmo in the payload.
 */
export const deserializeGizmos = (world: World, store: unknown): void => {
	if (!isRecord(store)) return
	if (store.version !== GIZMO_STORE_VERSION) return
	if (!Array.isArray(store.gizmos)) return

	const records: GizmoRecord[] = []
	for (const raw of store.gizmos) {
		const record = parseGizmoRecord(raw)
		if (record) records.push(record)
	}

	const spawned: { entity: Entity; record: GizmoRecord }[] = []
	for (const record of records) {
		const entity = spawnGizmo(world, {
			kind: record.kind,
			matrix: new Matrix4().fromArray(record.matrix),
			traits: [...commonTraits(record), ...kindTraits(record)],
		})
		entity.set(traits.Name, record.name)
		spawned.push({ entity, record })
	}

	for (const { entity, record } of spawned) {
		if (record.parent !== undefined) setParent(entity, record.parent)
	}
}
