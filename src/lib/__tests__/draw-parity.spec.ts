import type { Entity, World } from 'koota'
import type { BufferGeometry } from 'three'

import { createWorld } from 'koota'
import { describe, expect, it, vi } from 'vitest'

import { hierarchy, traits } from '$lib/ecs'

import type { EntityDraft } from './__fixtures__/entityDrafts'
import type { EntityTypeDescriptor } from './__fixtures__/entityMatrix'

import { drawDrawing, drawTransform, updateDrawing, updateModel, updateTransform } from '../draw'
import { toDrawing, toTransform } from './__fixtures__/entityDrafts'
import { casesFor, ENTITY_TYPES } from './__fixtures__/entityMatrix'

// Three points rather than none. An empty cloud makes `parseColors` build a
// colour attribute of itemSize 0, whose count is NaN, which is a shape no real
// cloud produces and which makes the pcd cases fail for the wrong reason.
vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() =>
		Promise.resolve({
			positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			colors: null,
		})
	),
}))

/** Lets an already-resolved worker promise deliver before the worlds are compared. */
const flushMicrotasks = async () => {
	await Promise.resolve()
	await Promise.resolve()
}

const round = (value: number) => Math.round(value * 1e6) / 1e6

const numbers = (values: Float32Array | undefined) =>
	values === undefined ? undefined : Array.from(values, round)

const bytes = (values: Uint8Array | undefined) => (values === undefined ? undefined : [...values])

const describeGeometry = (geometry: BufferGeometry | undefined) => {
	if (!geometry) return undefined

	const attributes: Record<string, { count: number; itemSize: number }> = {}
	for (const [name, attribute] of Object.entries(geometry.attributes)) {
		attributes[name] = { count: attribute.count, itemSize: attribute.itemSize }
	}

	// Compared as the vertex count actually rendered: a fresh geometry leaves
	// drawRange at Infinity while an updated one pins it to what was written,
	// which renders the same. A short range on a longer buffer does not.
	const vertices = geometry.getAttribute('position')?.count ?? 0

	return { attributes, renderedVertices: Math.min(geometry.drawRange.count, vertices) }
}

/**
 * Every trait `draw.ts` writes, flattened to comparable values. Buffer
 * geometries reduce to their attribute shape because the two paths build
 * different instances holding the same data.
 */
const dumpTraits = (entity: Entity) => ({
	matrix: entity.get(traits.Matrix)?.elements.map((value) => round(value)),
	parent: hierarchy.getParentName(entity),
	orphan: entity.get(traits.Orphan),
	center: entity.get(traits.Center),
	color: entity.get(traits.Color),
	colors: bytes(entity.get(traits.Colors)),
	opacity: entity.get(traits.Opacity),
	opacities: bytes(entity.get(traits.Opacities)),
	invisible: entity.has(traits.Invisible),
	axesHelper: entity.has(traits.ShowAxesHelper),
	removable: entity.has(traits.Removable),
	referenceFrame: entity.has(traits.ReferenceFrame),
	points: entity.has(traits.Points),
	box: entity.get(traits.Box),
	sphere: entity.get(traits.Sphere),
	capsule: entity.get(traits.Capsule),
	pointSize: entity.get(traits.PointSize),
	lineWidth: entity.get(traits.LineWidth),
	dotSize: entity.get(traits.DotSize),
	dotColors: bytes(entity.get(traits.DotColors)),
	positions: numbers(entity.get(traits.Positions)),
	linePositions: numbers(entity.get(traits.LinePositions)),
	instances: entity.get(traits.Instances),
	arrows: entity.get(traits.Arrows),
	geometry: describeGeometry(entity.get(traits.BufferGeometry)),
})

const spawn = (world: World, draft: EntityDraft): Entity =>
	draft.kind === 'transform'
		? drawTransform(world, toTransform(draft), traits.SnapshotAPI).entity
		: drawDrawing(world, toDrawing(draft), traits.SnapshotAPI).entity

const update = (
	world: World,
	entity: Entity,
	draft: EntityDraft,
	type: EntityTypeDescriptor
): Entity => {
	if (draft.kind === 'transform') {
		updateTransform(entity, toTransform(draft))
		return entity
	}

	if (type.updateVia === 'model') {
		return updateModel(world, entity, toDrawing(draft), traits.SnapshotAPI).entity
	}

	updateDrawing(world, entity, toDrawing(draft))
	return entity
}

/**
 * `applyShape`/`drawTransform` (spawn) and `updateShape`/`updateTransform`
 * (update) are parallel implementations of the same contract, so they can
 * drift. Each case reaches one end state two ways and asserts they agree.
 */
describe('draw spawn/update parity', () => {
	for (const type of ENTITY_TYPES) {
		describe(type.name, () => {
			for (const traitCase of casesFor(type)) {
				it(`${type.name} ${traitCase.name}`, async () => {
					const reference = createWorld()
					const candidate = createWorld()

					try {
						const target = type.draft(type.name)
						traitCase.base?.(target)
						traitCase.apply(target)

						const initial = type.draft(type.name)
						traitCase.base?.(initial)

						// A point cloud is parsed off the main thread, so each world has to
						// settle before the next step runs. Updating an entity whose buffer
						// has not arrived yet is a different question from whether spawn and
						// update agree, and it is covered separately below.
						const spawned = spawn(reference, target)
						await flushMicrotasks()

						const existing = spawn(candidate, initial)
						await flushMicrotasks()

						const updated = update(candidate, existing, target, type)
						await flushMicrotasks()

						expect(dumpTraits(updated)).toStrictEqual(dumpTraits(spawned))
					} finally {
						reference.destroy()
						candidate.destroy()
					}
				})
			}
		})
	}
})
