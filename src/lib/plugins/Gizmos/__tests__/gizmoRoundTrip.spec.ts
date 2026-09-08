import type { Entity } from 'koota'

import { createWorld, type World } from 'koota'
import { Matrix4 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import { asRGB } from '$lib/buffer'
import { traits } from '$lib/ecs'
import { getParentName, resolveOrphans, setParent } from '$lib/ecs/hierarchy'

import { deserializeGizmos } from '../deserializeGizmos'
import { GIZMO_STORE_VERSION, type GizmoStore } from '../gizmoRecord'
import { serializeGizmos } from '../serializeGizmos'
import { ARROW_COLOR, POLYLINE_COLOR, REFERENCE_GEOMETRY_COLOR, spawnGizmo } from '../spawn'
import { AngleMeasure, PolylineMeasure, ReferencePlane } from '../traits'

const resolveHierarchy = (world: World) => {
	resolveOrphans([...world.query(traits.Name)], [...world.query(traits.Orphan)])
}

interface PlacedGizmos {
	coordinateSystem: Entity
	referencePlane: Entity
	referenceGeometry: Entity
	arrow: Entity
	polyline: Entity
	angle: Entity
}

const placeEveryKind = (world: World): PlacedGizmos => {
	const coordinateSystem = spawnGizmo(world, {
		kind: 'coordinate system',
		matrix: new Matrix4().makeTranslation(1, 2, 3),
		traits: [traits.ReferenceFrame, traits.ShowAxesHelper],
	})

	const referencePlane = spawnGizmo(world, {
		kind: 'reference plane',
		matrix: new Matrix4().makeTranslation(4, 5, 6),
		traits: [
			ReferencePlane({ width: 300, height: 400, axis: 'xz' }),
			traits.Color(asRGB(REFERENCE_GEOMETRY_COLOR, { r: 0, g: 0, b: 0 })),
			traits.Opacity(0.5),
			traits.ShowAxesHelper,
		],
	})
	setParent(referencePlane, coordinateSystem.get(traits.Name))

	const referenceGeometry = spawnGizmo(world, {
		kind: 'reference box',
		matrix: new Matrix4().makeTranslation(7, 8, 9),
		traits: [
			traits.Box({ x: 100, y: 200, z: 300 }),
			traits.Color(asRGB(REFERENCE_GEOMETRY_COLOR, { r: 0, g: 0, b: 0 })),
			traits.Opacity(0.5),
			traits.Wireframe,
		],
	})

	const arrow = spawnGizmo(world, {
		kind: 'arrow',
		matrix: new Matrix4().makeTranslation(10, 11, 12),
		traits: [traits.Arrow, traits.Color(asRGB(ARROW_COLOR, { r: 0, g: 0, b: 0 }))],
	})

	const polyline = spawnGizmo(world, {
		kind: 'polyline',
		traits: [
			traits.LinePositions(new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2])),
			traits.LineWidth(3),
			traits.DotSize(20),
			traits.Color(asRGB(POLYLINE_COLOR, { r: 0, g: 0, b: 0 })),
			traits.DotColors(POLYLINE_COLOR),
			traits.ScreenSpace,
			PolylineMeasure({ mode: 'total' }),
		],
	})

	const angle = spawnGizmo(world, {
		kind: 'angle',
		traits: [
			traits.LinePositions(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
			traits.LineWidth(1.5),
			traits.Color(asRGB(POLYLINE_COLOR, { r: 0, g: 0, b: 0 })),
			AngleMeasure,
		],
	})

	return { coordinateSystem, referencePlane, referenceGeometry, arrow, polyline, angle }
}

describe('gizmo round trip', () => {
	let world: World
	let restoredWorld: World

	afterEach(() => {
		world?.destroy()
		restoredWorld?.destroy()
	})

	it('restores pose, parent, dimensions, colour, opacity, and kind-specific options for every kind', () => {
		world = createWorld()
		const placed = placeEveryKind(world)
		resolveHierarchy(world)

		const store = serializeGizmos(world)

		restoredWorld = createWorld()
		deserializeGizmos(restoredWorld, store)
		resolveHierarchy(restoredWorld)

		const restoredByName = new Map(
			[...restoredWorld.query(traits.Gizmo)].map((entity) => [entity.get(traits.Name), entity])
		)

		for (const [label, original] of Object.entries(placed)) {
			const restored = restoredByName.get(original.get(traits.Name))
			expect(restored, `expected a restored entity for ${label}`).toBeDefined()

			expect(restored!.get(traits.Matrix)!.elements).toEqual(original.get(traits.Matrix)!.elements)

			if (original.has(traits.Color)) {
				expect(restored!.get(traits.Color)!.r).toBeCloseTo(original.get(traits.Color)!.r, 2)
				expect(restored!.get(traits.Color)!.g).toBeCloseTo(original.get(traits.Color)!.g, 2)
				expect(restored!.get(traits.Color)!.b).toBeCloseTo(original.get(traits.Color)!.b, 2)
			} else {
				expect(restored!.has(traits.Color)).toBe(false)
			}

			if (original.has(traits.Opacity)) {
				expect(restored!.get(traits.Opacity)).toBe(original.get(traits.Opacity))
			} else {
				expect(restored!.has(traits.Opacity)).toBe(false)
			}
		}

		const restoredPlane = restoredByName.get(placed.referencePlane.get(traits.Name))!
		const restoredCoordinateSystem = restoredByName.get(placed.coordinateSystem.get(traits.Name))!

		expect(restoredPlane.get(ReferencePlane)).toEqual(placed.referencePlane.get(ReferencePlane))
		expect(restoredPlane.has(traits.ShowAxesHelper)).toBe(true)
		expect(getParentName(restoredPlane)).toBe(restoredCoordinateSystem.get(traits.Name))

		expect(restoredCoordinateSystem.has(traits.ReferenceFrame)).toBe(true)
		expect(restoredCoordinateSystem.has(traits.ShowAxesHelper)).toBe(true)

		const restoredBox = restoredByName.get(placed.referenceGeometry.get(traits.Name))!
		expect(restoredBox.get(traits.Box)).toEqual(placed.referenceGeometry.get(traits.Box))
		expect(restoredBox.has(traits.Wireframe)).toBe(true)

		const restoredArrow = restoredByName.get(placed.arrow.get(traits.Name))!
		expect(restoredArrow.has(traits.Arrow)).toBe(true)

		const restoredPolyline = restoredByName.get(placed.polyline.get(traits.Name))!
		expect([...restoredPolyline.get(traits.LinePositions)!]).toEqual([
			...placed.polyline.get(traits.LinePositions)!,
		])
		expect(restoredPolyline.get(traits.LineWidth)).toBe(placed.polyline.get(traits.LineWidth))
		expect(restoredPolyline.get(traits.DotSize)).toBe(placed.polyline.get(traits.DotSize))
		expect([...restoredPolyline.get(traits.DotColors)!]).toEqual([
			...placed.polyline.get(traits.DotColors)!,
		])
		expect(restoredPolyline.has(traits.ScreenSpace)).toBe(true)
		expect(restoredPolyline.get(PolylineMeasure)).toEqual(placed.polyline.get(PolylineMeasure))

		const restoredAngle = restoredByName.get(placed.angle.get(traits.Name))!
		expect([...restoredAngle.get(traits.LinePositions)!]).toEqual([
			...placed.angle.get(traits.LinePositions)!,
		])
		expect(restoredAngle.has(AngleMeasure)).toBe(true)
	})

	it('restores nothing when the store version does not match', () => {
		world = createWorld()
		spawnGizmo(world, { kind: 'arrow', traits: [traits.Arrow] })
		const store = serializeGizmos(world)

		restoredWorld = createWorld()
		deserializeGizmos(restoredWorld, { ...store, version: store.version + 1 } satisfies GizmoStore)

		expect([...restoredWorld.query(traits.Gizmo)]).toHaveLength(0)
	})

	it('does not throw on a malformed payload and restores what it can', () => {
		restoredWorld = createWorld()

		expect(() => deserializeGizmos(restoredWorld, undefined)).not.toThrow()
		expect(() => deserializeGizmos(restoredWorld, null)).not.toThrow()
		expect(() => deserializeGizmos(restoredWorld, 'not an object')).not.toThrow()
		expect(() => deserializeGizmos(restoredWorld, {})).not.toThrow()
		expect(() =>
			deserializeGizmos(restoredWorld, { version: GIZMO_STORE_VERSION, gizmos: 'not an array' })
		).not.toThrow()

		expect(() =>
			deserializeGizmos(restoredWorld, {
				version: GIZMO_STORE_VERSION,
				gizmos: [
					{ kind: 'arrow', name: 'ok arrow', matrix: Array.from({ length: 16 }).fill(0) },
					{ kind: 'unknown-kind', name: 'bad', matrix: Array.from({ length: 16 }).fill(0) },
					{
						kind: 'reference-geometry',
						name: 'bad shape',
						matrix: Array.from({ length: 16 }).fill(0),
					},
				],
			})
		).not.toThrow()

		expect([...restoredWorld.query(traits.Gizmo)]).toHaveLength(1)
		expect([...restoredWorld.query(traits.Gizmo)][0]!.get(traits.Name)).toBe('ok arrow')
	})

	it('excludes a non-gizmo entity from the payload', () => {
		world = createWorld()
		world.spawn(traits.Name('not a gizmo'), traits.Matrix(new Matrix4()))
		spawnGizmo(world, { kind: 'arrow', traits: [traits.Arrow] })

		const store = serializeGizmos(world)

		expect(store.gizmos).toHaveLength(1)
		expect(store.gizmos[0]!.kind).toBe('arrow')
	})
})
