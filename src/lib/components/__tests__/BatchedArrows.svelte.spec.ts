import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { tick } from 'svelte'
import { Matrix4, type Object3D } from 'three'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import MockCanvas from '$lib/__tests__/fixtures/MockCanvas.svelte'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import { BatchedArrow } from '$lib/three/BatchedArrow'

import BatchedArrows from '../BatchedArrows.svelte'

/**
 * The first arrow in a batch gets instance id 0. The mock keeps that numbering so the spec can
 * prove the renderer still updates it, and records every batch call without a WebGL context.
 */
type BatchMock = {
	mesh: Object3D & { setColorAt: Mock }
	addArrow: Mock
	updateArrow: Mock
	removeArrow: Mock
	reset: () => void
}

vi.mock('$lib/three/BatchedArrow', async () => {
	const { Object3D } = await vi.importActual<typeof import('three')>('three')
	let nextInstanceID = 0
	const batch: BatchMock = {
		mesh: Object.assign(new Object3D(), { setColorAt: vi.fn() }),
		addArrow: vi.fn(() => nextInstanceID++),
		updateArrow: vi.fn(),
		removeArrow: vi.fn(),
		reset() {
			nextInstanceID = 0
			batch.addArrow.mockClear()
			batch.updateArrow.mockClear()
			batch.removeArrow.mockClear()
			batch.mesh.setColorAt.mockClear()
		},
	}
	return {
		// A regular function so `new BatchedArrow()` works, and returning an object from a
		// constructor hands the caller that object.
		BatchedArrow: vi.fn(function BatchedArrowMock() {
			return batch
		}),
	}
})

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

vi.mock('@threlte/extras', async () => {
	const actual = await vi.importActual('@threlte/extras')
	return {
		...actual,
		useCursor: vi.fn(() => ({ onPointerEnter: vi.fn(), onPointerLeave: vi.fn() })),
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
			domElement: { getContext: vi.fn().mockReturnValue({}) },
			dispose: vi.fn(),
		})),
	}
})

const flush = async () => {
	await tick()
	await Promise.resolve()
	await Promise.resolve()
}

describe('BatchedArrows', () => {
	let world: World
	let unmount: () => void
	let batch: BatchMock

	beforeEach(async () => {
		world = createWorld()
		unmount = render(MockCanvas, {
			props: { child: BatchedArrows },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		}).unmount
		await flush()
		batch = vi.mocked(BatchedArrow).mock.results.at(-1)?.value as unknown as BatchMock
		batch.reset()
	})

	afterEach(async () => {
		unmount()
		await flush()
		world.destroy()
	})

	it('adds an arrow as instance 0 when the entity has no world matrix yet', async () => {
		world.spawn(traits.Arrow, traits.Color({ r: 1, g: 0, b: 0 }))
		await flush()

		expect(batch.addArrow).toHaveBeenCalledTimes(1)
		expect(batch.addArrow.mock.results[0]?.value).toBe(0)
	})

	it('updates instance 0 once its world matrix arrives', async () => {
		const entity = world.spawn(traits.Arrow, traits.Color({ r: 1, g: 0, b: 0 }))
		await flush()
		batch.updateArrow.mockClear()

		entity.add(traits.WorldMatrix(new Matrix4().makeTranslation(1, 2, 3)))
		await flush()

		expect(batch.updateArrow).toHaveBeenCalledTimes(1)
		const [instanceID, direction, origin] = batch.updateArrow.mock.calls[0] ?? []
		expect(instanceID).toBe(0)
		expect(direction.length()).toBeCloseTo(1)
		expect([origin.x, origin.y, origin.z]).toEqual([1, 2, 3])
	})

	it('recolours instance 0 when its color trait changes', async () => {
		const entity = world.spawn(
			traits.Arrow,
			traits.Color({ r: 1, g: 0, b: 0 }),
			traits.WorldMatrix(new Matrix4())
		)
		await flush()

		entity.set(traits.Color, { r: 0, g: 1, b: 0 })
		await flush()

		expect(batch.mesh.setColorAt).toHaveBeenCalledTimes(1)
		expect(batch.mesh.setColorAt.mock.calls[0]?.[0]).toBe(0)
	})
})
