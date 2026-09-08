import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

// LineTool.svelte's script module (where `nearestVertex` lives) still evaluates the
// component's imports on load. `MeasurePoint` pulls in `@threlte/core`'s `T`, which the
// shared mock in vitest-setup-client.ts does not export, so it is mocked away here too.
vi.mock('$lib/components/MeasurePoint.svelte', () => ({ default: vi.fn() }))

const { nearestVertex } = await import('../tools/LineTool.svelte')

describe('nearestVertex', () => {
	const origin = new Vector3(0, 0, 0)
	const oneMeterAway = new Vector3(1, 0, 0)

	it('returns undefined when no vertex is within the snap distance', () => {
		expect(nearestVertex([origin, oneMeterAway], new Vector3(0.5, 0.5, 0), 0.05)).toBeUndefined()
	})

	it('returns the index of the vertex within the snap distance', () => {
		expect(nearestVertex([origin, oneMeterAway], new Vector3(0.02, 0, 0), 0.05)).toBe(0)
	})

	it('returns the closer of two vertices both within the snap distance', () => {
		const points = [origin, new Vector3(0.06, 0, 0)]

		expect(nearestVertex(points, new Vector3(0.04, 0, 0), 0.1)).toBe(1)
	})

	it('treats the snap distance as an exclusive boundary', () => {
		expect(nearestVertex([origin], new Vector3(0.05, 0, 0), 0.05)).toBeUndefined()
	})
})
