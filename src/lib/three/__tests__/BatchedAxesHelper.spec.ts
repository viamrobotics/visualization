import type { InterleavedBufferAttribute } from 'three'

import { Matrix4, OrthographicCamera, Scene, WebGLRenderer } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { describe, expect, it, vi } from 'vitest'

import { BatchedAxesHelpers, rejectCollapsedSegments } from '../BatchedAxesHelper'

const GUARD = 'if ( instanceStart == instanceEnd )'

describe('rejectCollapsedSegments', () => {
	const source = new LineMaterial().vertexShader
	const patched = rejectCollapsedSegments(source)

	it('matches the shader three ships, rather than passing it through', () => {
		expect(patched).not.toBe(source)
		expect(patched).toContain(GUARD)
	})

	it('rejects the instance before the shader reads the endpoints it compares', () => {
		expect(patched.indexOf(GUARD)).toBeLessThan(patched.indexOf('vec4( instanceStart, 1.0 )'))
	})
})

describe('BatchedAxesHelpers', () => {
	// Whether a zero-length segment draws its round cap is driver-dependent, so a
	// headless render cannot see the dot. `rejectCollapsedSegments` keys on the
	// collapse, and these pin that the class still produces it.
	const FLOATS_PER_SEGMENT = 6
	const FLOATS_PER_AXES = 18

	const segmentsOf = (helpers: BatchedAxesHelpers, index: number) => {
		const attribute = helpers.geometry.attributes.instanceStart as InterleavedBufferAttribute
		const floats = attribute.data.array
		const base = index * FLOATS_PER_AXES
		const point = (offset: number) => [
			floats[base + offset],
			floats[base + offset + 1],
			floats[base + offset + 2],
		]

		return [0, 1, 2].map((segment) => ({
			start: point(segment * FLOATS_PER_SEGMENT),
			end: point(segment * FLOATS_PER_SEGMENT + 3),
		}))
	}

	it('collapses a removed helper to a zero-length segment', () => {
		const helpers = new BatchedAxesHelpers()
		const index = helpers.addHelper(new Matrix4().makeTranslation(1, 2, 3))

		helpers.removeHelper(index)

		for (const { start, end } of segmentsOf(helpers, index)) {
			expect(start).toEqual(end)
		}
	})

	it('collapses a hidden helper to a zero-length segment', () => {
		const helpers = new BatchedAxesHelpers()
		const index = helpers.addHelper(new Matrix4().makeTranslation(1, 2, 3))

		helpers.setVisibleAt(index, false)

		for (const { start, end } of segmentsOf(helpers, index)) {
			expect(start).toEqual(end)
		}
	})

	it('spans the axis length for a visible helper', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: 0.5 })
		const index = helpers.addHelper(new Matrix4())

		const [x, y, z] = segmentsOf(helpers, index)
		expect(x.end).toEqual([0.5, 0, 0])
		expect(y.end).toEqual([0, 0.5, 0])
		expect(z.end).toEqual([0, 0, 0.5])
	})

	it('produces a shader the driver accepts', () => {
		const renderer = new WebGLRenderer()
		const scene = new Scene()
		const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
		camera.position.z = 5

		const helpers = new BatchedAxesHelpers()
		helpers.material.resolution.set(200, 200)
		helpers.addHelper(new Matrix4())
		scene.add(helpers)

		const error = vi.spyOn(console, 'error').mockImplementation(() => {})

		try {
			renderer.render(scene, camera)
			expect(error).not.toHaveBeenCalled()
		} finally {
			error.mockRestore()
			renderer.dispose()
		}
	})
})
