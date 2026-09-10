import type { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

import { render } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'

import MockCanvas from '$lib/__tests__/fixtures/MockCanvas.svelte'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

import GizmoPlane from '../GizmoPlane.svelte'
import { ReferencePlane } from '../traits'

// @threlte/extras/@threlte/core components need a real <Canvas> context, which this
// fixture supplies. Mirrors the override MeasurePoint.svelte.spec.ts uses.
vi.mock('@threlte/core', async () => {
	const actual = await vi.importActual('@threlte/core')
	return {
		...actual,
		currentWritable: vi.fn(() => ({
			subscribe: () => () => {},
			set: () => {},
			update: () => {},
		})),
	}
})

vi.mock('three', async () => {
	const actual = await vi.importActual('three')

	return {
		...actual,
		WebGLRenderer: vi.fn().mockImplementation(() => ({
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			domElement: {
				getContext: vi.fn().mockReturnValue({}),
			},
			dispose: vi.fn(),
		})),
	}
})

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('GizmoPlane', () => {
	const world = createWorld()

	it('renders a quad sized from the mm trait after mm-to-m conversion', () => {
		const entity = world.spawn(
			traits.WorldMatrix,
			traits.Name('plane 1'),
			ReferencePlane({ width: 200, height: 400, axis: 'xy' })
		)

		let capturedRef: Mesh | undefined

		render(MockCanvas, {
			props: {
				child: GizmoPlane,
				entity,
				oncreate: (ref: Mesh) => {
					capturedRef = ref
				},
			},
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		const geometry = capturedRef?.geometry as PlaneGeometry | undefined

		// 200mm/400mm converted to meters, not the raw trait numbers — a renderer
		// that forgot the mm-to-m conversion would report 200/400 here instead.
		expect(geometry?.parameters.width).toBeCloseTo(0.2)
		expect(geometry?.parameters.height).toBeCloseTo(0.4)
	})

	it('updates the material color when the entity Color trait changes', async () => {
		const entity = world.spawn(
			traits.WorldMatrix,
			traits.Name('plane 2'),
			traits.Color({ r: 1, g: 0, b: 0 }),
			ReferencePlane({ width: 200, height: 400, axis: 'xy' })
		)

		let capturedRef: Mesh | undefined

		render(MockCanvas, {
			props: {
				child: GizmoPlane,
				entity,
				oncreate: (ref: Mesh) => {
					capturedRef = ref
				},
			},
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		entity.set(traits.Color, { r: 0, g: 1, b: 0 })
		await tick()

		const material = capturedRef?.material as MeshBasicMaterial | undefined

		expect(material?.color.getHexString()).toBe('00ff00')
	})
})
