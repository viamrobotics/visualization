import type { World } from 'koota'
import type { Intersection } from 'three'

import { render } from '@testing-library/svelte'
import { Object3D, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { createHotkeys, HOTKEYS_CONTEXT_KEY } from '$lib/hooks/useHotkeys.svelte'

// LineTool.svelte's script module (where `nearestVertex` lives) still evaluates the
// component's imports on load. `MeasurePoint` pulls in `@threlte/core`'s `T`, which the
// shared mock in vitest-setup-client.ts does not export, so it is mocked away here too.
vi.mock('$lib/components/MeasurePoint.svelte', () => ({ default: vi.fn() }))

// `useGizmoInputs` (wired through `usePending`) reads `useThrelte().dom` to listen for
// right-click cancel, and the shared mock has no `dom` field.
vi.mock('@threlte/core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@threlte/core')>()),
	useThrelte: vi.fn(() => ({ dom: document.createElement('div') })),
}))

// Driving a real pointer raycast needs a live `<Canvas>`, a camera, and scene geometry to
// hit, none of which these component tests stand up. `usePlace` (and, before the refactor
// this spec also has to pass against, `LineTool`'s own `useMouseRaycaster` call) both sit
// on top of this hook, so replacing it lets every case fire a click or move with a
// fabricated raycast hit directly.
const { mockClickCallbacks, mockMoveCallbacks } = vi.hoisted(() => ({
	mockClickCallbacks: [] as Array<(event: { intersections: Intersection[] }) => void>,
	mockMoveCallbacks: [] as Array<(event: { intersections: Intersection[] }) => void>,
}))

vi.mock('$lib/hooks/useMouseRaycaster.svelte', () => ({
	useMouseRaycaster: () => ({
		raycaster: { firstHitOnly: false },
		onclick: (cb: (event: { intersections: Intersection[] }) => void) => {
			mockClickCallbacks.push(cb)
		},
		onmove: (cb: (event: { intersections: Intersection[] }) => void) => {
			mockMoveCallbacks.push(cb)
		},
		onpointerenter: () => {},
		onpointerleave: () => {},
	}),
}))

const { nearestVertex } = await import('../tools/LineTool.svelte')
const { PolylineMeasure, PendingGizmo } = await import('../traits')
const lineToolHostModule = await import('./__fixtures__/LineToolHost.svelte')
const LineToolHost = lineToolHostModule.default

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

const makeIntersection = (point: Vector3): Intersection =>
	({
		object: new Object3D(),
		point,
		distance: 0,
	}) as unknown as Intersection

const renderHost = (
	props: {
		lineSpace?: 'world' | 'screen'
		lineMeasure?: 'none' | 'segment' | 'total'
		vertexSnapDistance?: number
		snapping?: boolean
	} = {}
) => {
	let world: World | undefined

	render(LineToolHost, {
		props: {
			...props,
			onReady: (hostWorld: World) => {
				world = hostWorld
			},
		},
		context: new Map<symbol, unknown>([[HOTKEYS_CONTEXT_KEY, createHotkeys()]]),
	})

	if (!world) throw new Error('LineToolHost never called onReady')

	return world
}

const click = (point: Vector3) => {
	mockClickCallbacks.at(-1)?.({ intersections: [makeIntersection(point)] })
}

describe('LineTool', () => {
	it('appends a vertex to the pending polyline on each click', () => {
		const world = renderHost()
		const first = new Vector3(0, 0, 0)
		const second = new Vector3(1, 0, 0)

		click(first)
		click(second)

		const [entity] = world.query(PendingGizmo)
		const positions = [...(entity.get(traits.LinePositions) ?? [])]

		expect(positions).toEqual([first.x, first.y, first.z, second.x, second.y, second.z])
	})

	it('closes the loop when a click lands on the first vertex with three or more vertices placed', () => {
		const world = renderHost({ snapping: true, vertexSnapDistance: 50 })
		const first = new Vector3(0, 0, 0)
		const second = new Vector3(1, 0, 0)
		const third = new Vector3(1, 1, 0)

		click(first)
		click(second)
		click(third)

		const [pendingBeforeClose] = world.query(PendingGizmo)
		click(first.clone())

		expect(world.query(PendingGizmo)).toHaveLength(0)
		expect([...(pendingBeforeClose.get(traits.LinePositions) ?? [])]).toEqual([
			first.x,
			first.y,
			first.z,
			second.x,
			second.y,
			second.z,
			third.x,
			third.y,
			third.z,
			first.x,
			first.y,
			first.z,
		])
	})

	it('attaches ScreenSpace and PolylineMeasure traits from the armed menu options', () => {
		const world = renderHost({ lineSpace: 'screen', lineMeasure: 'segment' })

		click(new Vector3(0, 0, 0))

		const [entity] = world.query(PendingGizmo)

		expect(entity.has(traits.ScreenSpace)).toBe(true)
		expect(entity.has(PolylineMeasure)).toBe(true)
		expect(entity.get(PolylineMeasure)?.mode).toBe('segment')
	})

	it('omits ScreenSpace and PolylineMeasure when the armed options are world space and no measure', () => {
		const world = renderHost({ lineSpace: 'world', lineMeasure: 'none' })

		click(new Vector3(0, 0, 0))

		const [entity] = world.query(PendingGizmo)

		expect(entity.has(traits.ScreenSpace)).toBe(false)
		expect(entity.has(PolylineMeasure)).toBe(false)
	})
})
