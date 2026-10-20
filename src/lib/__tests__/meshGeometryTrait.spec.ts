import { commonApi, Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'

const asciiStl = `solid tri
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid tri
`

const asciiStlTwoFacets = `solid tri
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 0 1
  endloop
endfacet
endsolid tri
`

const stlGeometry = (stl = asciiStl): ViamGeometry =>
	new ViamGeometry({
		geometryType: {
			case: 'mesh',
			value: new commonApi.Mesh({
				contentType: 'stl',
				mesh: new TextEncoder().encode(stl),
			}),
		},
	})

/**
 * Not covered by `mesh.spec.ts`: a regression to `parsePlyInput` here still puts an entity in the
 * world, since `PLYLoader` answers STL bytes with an empty geometry rather than throwing.
 */
describe('mesh geometry reaches the trait layer', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('Geometry parses an stl mesh into real vertices', () => {
		world = createWorld()
		const entity = world.spawn(traits.Geometry(stlGeometry()))

		expect(entity.get(traits.BufferGeometry)!.getAttribute('position').count).toBe(3)
	})

	it('updateGeometryTrait parses an stl mesh for an entity with no prior BufferGeometry', () => {
		world = createWorld()
		const entity = world.spawn(traits.Box())

		traits.updateGeometryTrait(entity, stlGeometry())

		expect(entity.has(traits.Box)).toBe(false)
		expect(entity.get(traits.BufferGeometry)!.getAttribute('position').count).toBe(3)
	})

	// Every trajectory step of a motion replay resends each link's mesh unchanged, in a proto it
	// decoded itself. Reusing the geometry is what keeps a scrub from reparsing every link per step.
	it('updateGeometryTrait keeps the geometry when an equal mesh arrives in a distinct proto', () => {
		world = createWorld()
		const entity = world.spawn(traits.Geometry(stlGeometry()))
		const first = entity.get(traits.BufferGeometry)!

		traits.updateGeometryTrait(entity, stlGeometry())

		expect(entity.get(traits.BufferGeometry)).toBe(first)
		expect(first.getAttribute('position').count).toBe(3)
	})

	it('updateGeometryTrait replaces and disposes the geometry when the mesh changes', () => {
		world = createWorld()
		const entity = world.spawn(traits.Geometry(stlGeometry()))
		const first = entity.get(traits.BufferGeometry)!
		const disposed = vi.fn()
		first.addEventListener('dispose', disposed)

		traits.updateGeometryTrait(entity, stlGeometry(asciiStlTwoFacets))

		expect(entity.get(traits.BufferGeometry)).not.toBe(first)
		expect(entity.get(traits.BufferGeometry)!.getAttribute('position').count).toBe(6)
		expect(disposed).toHaveBeenCalledOnce()
	})
})
